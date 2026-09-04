/**
 * The Workers runtime (nodejs_compat + global_fetch_strictly_public) cannot run
 * @clerk/nextjs middleware reliably, so auth is verified directly:
 *   - NOT `@clerk/nextjs`: its middleware/`auth()` relies on standard Next.js
 *     request plumbing that vinext's Vite-based runtime does not provide.
 */

import { env } from "cloudflare:workers";
import { verifyToken } from "@clerk/backend";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import type { User as SchemaUser } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/schema";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

export const CLERK_SESSION_COOKIE = "__session";

export interface ClerkClaims {
  sub: string;
  sid?: string;
  orgId?: string;
  exp?: number;
  iat?: number;
}

export interface ClerkAuthContext {
  userId: string;
  clerkId: string;
  sessionId: string | null;
  claims: ClerkClaims;
  token: string;
}

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

export async function getAuthClerk(request?: Request): Promise<ClerkAuthContext | null> {
  try {
    return await resolveClaims(request);
  } catch (error) {
    console.error("[clerk] failed to resolve session:", error);
    return null;
  }
}

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

export interface DbUser {
  id: string;
  handle: string | null;
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
