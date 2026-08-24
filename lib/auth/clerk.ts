/**
 * Server-side Clerk authentication for vinext + Cloudflare Workers.
 *
 * The Workers runtime (nodejs_compat + global_fetch_strictly_public) cannot run
 * @clerk/nextjs middleware reliably, so auth is verified directly:
 *
 *   1. The browser sends the Clerk session JWT in the `__session` cookie.
 *   2. `verifyToken()` from @clerk/backend validates it against Clerk's JWKS
 *      (plain global fetch — fully Workers-compatible, cached in-module).
 *   3. The JWT `sub` claim is the Clerk user id ("clerkId"). It is mapped to
 *      the local Postgres user row via `user.clerk_id` (stamped by the 53-user
 *      import; new users get it from the Clerk webhook or use it as their PK).
 *
 * Package choice (documented decision):
 *   - `@clerk/react`  → client provider + hooks (lib/auth/client.tsx)
 *   - `@clerk/backend` → server-side JWT verification (this file) + webhook
 *     + Backend API account deletion (app/api/account/delete)
 *   - NOT `@clerk/nextjs`: its middleware/`auth()` relies on standard Next.js
 *     request plumbing that vinext's Vite-based runtime does not provide.
 *
 * Environment variables are loaded from Cloudflare Workers bindings:
 *   - Production: wrangler secret put CLERK_SECRET_KEY / CLERK_WEBHOOK_SECRET
 *   - Development: .dev.vars
 */

import { env } from "cloudflare:workers";
import { verifyToken } from "@clerk/backend";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import type { User as SchemaUser } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

/** Cookie holding the Clerk session JWT. */
export const CLERK_SESSION_COOKIE = "__session";

/** Cookie holding the Clerk client token (device identity, set even signed out). */
export const CLERK_CLIENT_COOKIE = "__client";

/**
 * Minimal shape of the Clerk session JWT claims this app consumes.
 * `sub` is the Clerk user id, `sid` the Clerk session id.
 */
export interface ClerkClaims {
  /** Clerk user id (`sub`). */
  sub: string;
  /** Clerk session id, when present. */
  sid?: string;
  /** Organization id for org-scoped tokens (unused here, kept for completeness). */
  orgId?: string;
  /** Expiration (seconds since epoch). */
  exp?: number;
  /** Issued-at (seconds since epoch). */
  iat?: number;
}

/** Verified Clerk identity resolved from a request. */
export interface ClerkAuthContext {
  /** Convenience alias of `clerkId`. */
  userId: string;
  /** Clerk user id from the verified JWT `sub` claim. */
  clerkId: string;
  /** Clerk session id, when present. */
  sessionId: string | null;
  /** Full verified claim set. */
  claims: ClerkClaims;
  /** Raw JWT, when it was read from a cookie/bearer header. */
  token: string;
}

/**
 * Verify a Clerk session JWT against Clerk's JWKS.
 *
 * @returns The verified claims, or null when verification fails
 *   (expired, malformed, JWKS unavailable…). Verification failures are logged
 *   and returned as null so callers treat "not authenticated" uniformly; a
 *   missing CLERK_SECRET_KEY is a hard misconfiguration and throws.
 */
export async function verifyClerkToken(token: string): Promise<ClerkClaims | null> {
  if (!token) return null;

  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is not configured. Set it via `wrangler secret put CLERK_SECRET_KEY` (prod) or .dev.vars (dev).",
    );
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    if (!payload?.sub) return null;
    return {
      sub: payload.sub,
      sid: payload.sid,
      orgId: payload.org_id,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch (error) {
    console.warn("[clerk] session token verification failed:", error);
    return null;
  }
}

/** Read a named cookie out of a raw `Cookie` header value. */
function readCookieFromHeader(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/**
 * Extract the session token from a Request: `__session` cookie first, then an
 * `Authorization: Bearer <jwt>` header (handy for API clients and tests).
 */
export function extractClerkTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const fromCookie = readCookieFromHeader(cookieHeader, CLERK_SESSION_COOKIE);
  if (fromCookie) return fromCookie;

  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim() || null;
  }
  return null;
}

async function resolveClaims(request?: Request): Promise<ClerkAuthContext | null> {
  let token: string | null;
  if (request) {
    token = extractClerkTokenFromRequest(request);
  } else {
    // RSC / route-handler path without an explicit Request: read via next/headers.
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(CLERK_SESSION_COOKIE)?.value ?? null;
    } catch {
      token = null;
    }
  }
  if (!token) return null;

  const claims = await verifyClerkToken(token);
  if (!claims) return null;

  return {
    userId: claims.sub,
    clerkId: claims.sub,
    sessionId: claims.sid ?? null,
    claims,
    token,
  };
}

/**
 * Resolve and verify the Clerk session for the current request.
 *
 * Pass an explicit `Request` when one is available (worker fetch handler, API
 * routes receiving `request`); otherwise the token is read from Next.js
 * request cookies (`next/headers`) — valid inside RSC/route-handler contexts.
 *
 * @example
 * ```ts
 * const auth = await getAuthClerk(request);
 * if (!auth) return new Response("Unauthorized", { status: 401 });
 * // auth.clerkId is the Clerk user id; map to Postgres via requireAuthClerk()
 * ```
 */
export async function getAuthClerk(request?: Request): Promise<ClerkAuthContext | null> {
  try {
    return await resolveClaims(request);
  } catch (error) {
    console.error("[clerk] failed to resolve session:", error);
    return null;
  }
}

/**
 * Convenience helper: the current Clerk user id, or null.
 */
export async function getClerkUserId(request?: Request): Promise<string | null> {
  return (await getAuthClerk(request))?.clerkId ?? null;
}

/**
 * App-owned user shape exposed on every authenticated context. `id` is the
 * app/legacy Postgres user id (Clerk `externalId` for imported users), NOT
 * the Clerk id — foreign keys across resumes/siteData/etc. key on it.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: SchemaUser["privacySettings"];
  onboardingCompleted: boolean;
  role: SchemaUser["role"];
}

/** Validated local-row columns handed to route handlers alongside `db`. */
export interface DbUser {
  id: string;
  handle: string | null;
  /** Clerk identity (`user_...`) used for Backend API calls. */
  clerkId: string;
}

type RequireAuthResult =
  | {
      user: AuthUser;
      db: Database;
      dbUser: DbUser;
      env: CloudflareEnv;
      error: null;
    }
  | {
      user: null;
      db: null;
      dbUser: null;
      env: null;
      error: Response;
    };

/**
 * Require authentication AND validate that a local user row exists for the
 * Clerk identity.
 *
 * Mapping: JWT `sub` (Clerk user id) → `user.clerk_id` → full Postgres row. A
 * signed-in Clerk user without a mapped row (webhook not yet processed or
 * already deleted) gets a 404 — same semantics as the previous stale-session
 * check.
 *
 * @param errorMessage Custom 401 message for unauthenticated requests.
 */
export async function requireAuthClerk(errorMessage: string): Promise<RequireAuthResult> {
  const auth = await getAuthClerk();
  if (!auth) {
    return {
      user: null,
      db: null,
      dbUser: null,
      env: null,
      error: createErrorResponse(errorMessage, ERROR_CODES.UNAUTHORIZED, 401),
    };
  }

  const db = getDb(env.HYPERDRIVE);

  const rows = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      image: userTable.image,
      handle: userTable.handle,
      headline: userTable.headline,
      privacySettings: userTable.privacySettings,
      onboardingCompleted: userTable.onboardingCompleted,
      role: userTable.role,
    })
    .from(userTable)
    .where(eq(userTable.clerkId, auth.clerkId))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    return {
      user: null,
      db: null,
      dbUser: null,
      env: null,
      error: createErrorResponse(
        "User account not found. Please re-authenticate.",
        ERROR_CODES.NOT_FOUND,
        404,
      ),
    };
  }

  const row = rows[0];

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image,
      handle: row.handle,
      headline: row.headline,
      privacySettings: row.privacySettings,
      onboardingCompleted: Boolean(row.onboardingCompleted),
      role: row.role,
    },
    db,
    dbUser: { id: row.id, handle: row.handle, clerkId: auth.clerkId },
    env,
    error: null,
  };
}
