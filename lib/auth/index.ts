/**
 * Server-side Better Auth configuration for vinext with Cloudflare D1
 *
 * IMPORTANT: The auth instance must be created inside request handlers because
 * the D1 database binding is only available within the Cloudflare Workers
 * request context. Attempting to create the instance at module scope will fail.
 *
 * OPTIMIZATION: The auth instance is cached per D1 binding identity using a
 * module-level WeakMap. Within a single Cloudflare Workers isolate, the D1
 * binding object reference is stable, so we avoid recreating the entire
 * betterAuth() config (schema parsing, middleware pipeline, plugin init, route
 * generation) on every request. The WeakMap ensures automatic cleanup if the
 * binding is ever garbage-collected between isolate lifetimes.
 *
 * Environment variables are loaded from:
 * - Production: Cloudflare Workers env bindings (via wrangler secret put)
 * - Development: env bindings (via .dev.vars)
 */

import { env } from "cloudflare:workers";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { createEmailSender } from "@/lib/email/cloudflare";
import { isDisposableEmail } from "@/lib/email/disposable-check";
import { generateReferralCode } from "@/lib/utils/referral-code";
import { DEFAULT_PRIVACY_SETTINGS_JSON } from "@/lib/utils/privacy";
import {
  getEmailThrottleKey,
  isThrottled,
} from "@/lib/auth/email-throttle";
import { getRecipientDomain } from "@/lib/utils/get-recipient-domain";
import { log } from "@/lib/utils/log";

/**
 * Checks throttle state for an auth email and logs when throttled.
 * Wraps key generation + isThrottled in fail-open try/catch; log is outside
 * that try so a logging failure does NOT fall through to send (fail-closed
 * for log, fail-open only for throttle check).
 */
function throttleOrLog(email: string, type: "reset" | "verification"): boolean {
  let throttled = false;
  try {
    throttled = isThrottled(getEmailThrottleKey(email, type));
  } catch {
    // Fail-open: proceed to send if throttle check errors
  }
  if (throttled) {
    try {
      log("warn", "Auth email throttled", {
        type,
        domain: getRecipientDomain(email),
      });
    } catch {}
    return true;
  }
  return false;
}

/**
 * Module-level caches scoped to isolate lifetime.
 *
 * WeakMap<D1Database, D1Database> — avoids wrapping the same D1 binding in
 * nested Proxy layers across repeated calls within one isolate.
 *
 * WeakMap<D1Database, Auth> — caches the fully-constructed betterAuth()
 * instance per D1 binding identity. The auth instance is stateless (headers
 * are passed at call sites), so sharing it across requests is safe.
 */
const d1ProxyCache = new WeakMap<D1Database, D1Database>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Auth generic variance prevents storing specific config types in WeakMap<D1Database, Auth<BetterAuthOptions>>
const authInstanceCache = new WeakMap<D1Database, any>();

/**
 * Wraps a D1Database to automatically convert Date objects to ISO strings.
 *
 * This is a workaround for Better Auth's drizzle adapter bug where the
 * `supportsDates: false` option is accepted but never passed to the
 * underlying adapter factory. D1 doesn't accept Date objects directly,
 * so we intercept and convert them before they reach D1.
 *
 * Results are cached per D1 binding in a WeakMap so we never create
 * nested Proxy wrappers for the same underlying binding.
 */
function wrapD1WithDateSerialization(d1: D1Database): D1Database {
  const cached = d1ProxyCache.get(d1);
  if (cached) return cached;

  const proxy = new Proxy(d1, {
    get(target, prop, _receiver) {
      if (prop === "prepare") {
        return (query: string) => {
          const stmt = target.prepare(query);
          return new Proxy(stmt, {
            get(stmtTarget, stmtProp, _stmtReceiver) {
              if (stmtProp === "bind") {
                return (...args: unknown[]) => {
                  const serializedArgs = args.map((arg) =>
                    arg instanceof Date ? arg.toISOString() : arg,
                  );
                  return stmtTarget.bind(...serializedArgs);
                };
              }
              // SAFETY: stmtProp is a Proxy trap key for the D1PreparedStatement; direct bracket access forwards correctly in Workers runtime.
              const value = stmtTarget[stmtProp as keyof typeof stmtTarget];
              return value instanceof Function ? value.bind(stmtTarget) : value;
            },
          });
        };
      }
      // SAFETY: prop is a Proxy trap key for D1Database; direct bracket access forwards correctly in Workers runtime.
      const value = target[prop as keyof D1Database];
      return value instanceof Function ? value.bind(target) : value;
    },
  });

  d1ProxyCache.set(d1, proxy);
  return proxy;
}

export function getEnvValue(env: Partial<CloudflareEnv>, key: keyof CloudflareEnv): string {
  const cfValue = env[key];
  // SAFETY: CloudflareEnv value is string validated via zod safeParse before cast.
  if (z.string().safeParse(cfValue).success && String(cfValue as string).trim() !== "") {
    // SAFETY: zod safeParse above guarantees cfValue is string.
    return cfValue as string;
  }
  const processValue = process.env[key];
  if (processValue && processValue.trim() !== "") {
    return processValue;
  }
  throw new Error(
    `Missing required environment variable: ${key}. ` +
      `Set it via .dev.vars (dev) or 'wrangler secret put ${key}' (prod).`,
  );
}

/**
 * Creates (or returns a cached) Better Auth instance for the current isolate's
 * D1 binding.
 *
 * The instance is cached in a module-level WeakMap keyed by the raw D1 binding
 * object. Within a Cloudflare Workers isolate, `env.CLICKFOLIO_DB` is the same object
 * reference on every request, so the betterAuth() constructor (schema parsing,
 * middleware pipeline, plugin init, route generation) runs exactly once per
 * isolate rather than once per request.
 *
 * Nothing request-specific (headers, cookies, request objects) is captured in
 * the cache -- those are always passed at call sites like
 * `auth.api.getSession({ headers })`.
 *
 * @returns Configured Better Auth instance
 *
 * @example
 * ```ts
 * // In an API route
 * export async function GET(request: Request) {
 *   const auth = await getAuth();
 *   return auth.handler(request);
 * }
 * ```
 */
export async function getAuth() {
  const rawD1 = env.CLICKFOLIO_DB;

  // Fast path: return cached instance if we already built one for this binding
  const cached = authInstanceCache.get(rawD1);
  if (cached) return cached;

  // Slow path: first request in this isolate -- build everything once
  // SAFETY: env is Workers runtime binding matching CloudflareEnv; cast narrows untyped env object to typed interface for env var access.
  const typedEnv = env as Partial<CloudflareEnv>;
  const wrappedD1 = wrapD1WithDateSerialization(rawD1);
  const db = drizzle(wrappedD1, { schema });

  // Get secrets from Cloudflare env with fallback to process.env
  const baseURL = getEnvValue(typedEnv, "BETTER_AUTH_URL");
  const secret = getEnvValue(typedEnv, "BETTER_AUTH_SECRET");
  const googleClientId = getEnvValue(typedEnv, "GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnvValue(typedEnv, "GOOGLE_CLIENT_SECRET");

  const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    baseURL,
    secret,
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    },
    user: {
      additionalFields: {
        handle: {
          type: "string",
          required: false,
          input: true,
        },
        headline: {
          type: "string",
          required: false,
          input: true,
        },
        privacySettings: {
          type: "string",
          required: false,
          defaultValue: DEFAULT_PRIVACY_SETTINGS_JSON,
        },
        onboardingCompleted: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
        role: {
          type: "string",
          required: false,
        },
        roleSource: {
          type: "string",
          required: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 30, // 30 minutes cache
      },
    },
    trustedOrigins: [
      baseURL,
      // Allow localhost dev servers (vinext dev + Workers preview)
      "http://localhost:3000",
      "http://localhost:8787",
      // Production domains
      "https://clickfolio.me",
      "https://www.clickfolio.me",
      // Allow HTTP variant for local DNS testing (clickfolio.me → 127.0.0.1)
      ...(process.env.NODE_ENV !== "production" ? ["http://clickfolio.me"] : []),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Check for disposable email before allowing signup
            try {
              // SAFETY: typedEnv is Partial<CloudflareEnv> with optional KV binding; cast to access optional CLICKFOLIO_DISPOSABLE_DOMAINS, fallback to null if missing.
              const result = await isDisposableEmail(
                user.email,
                (typedEnv as { CLICKFOLIO_DISPOSABLE_DOMAINS?: KVNamespace })
                  .CLICKFOLIO_DISPOSABLE_DOMAINS ?? null,
              );
              if (result.disposable) {
                throw new APIError("BAD_REQUEST", {
                  message: "Please use a permanent email address to sign up",
                });
              }
            } catch (error) {
              // Re-throw APIError (our intentional block), swallow all other errors (fail open)
              if (error instanceof APIError) throw error;
              console.error("[AUTH] Disposable email check failed, allowing signup:", error);
            }
            // Generate referral code (existing logic)
            try {
              return {
                data: {
                  ...user,
                  referralCode: generateReferralCode(),
                },
              };
            } catch (error) {
              // Log but don't crash signup - referralCode can be backfilled later
              console.error("[AUTH] Failed to generate referral code during signup:", error);
              return { data: user };
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        // Server-side 60s per-email throttle — prevents bot amplification to 24k.
        // Fail-open, pretend-sent on throttle to avoid oracle leaks.
        // Defense-in-depth: lib/email/cloudflare.ts also enforces this (records
        // only after successful send); here we use read-only isThrottled so the
        // first send is still recorded downstream and the window is shared.
        if (throttleOrLog(user.email, "reset")) return;
        // SAFETY: env is Workers runtime CloudflareEnv; cast is safe for email sender which expects CloudflareEnv bindings.
        const { sendPasswordResetEmail } = createEmailSender(env as CloudflareEnv, baseURL);
        const result = await sendPasswordResetEmail({
          email: user.email,
          resetUrl: url,
          userName: user.name,
        });
        if (!result.success) {
          console.error("[AUTH] Failed to send reset email:", result.error);
        }
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        if (throttleOrLog(user.email, "verification")) return;
        // SAFETY: env is Workers runtime CloudflareEnv; cast is safe for email sender which expects CloudflareEnv bindings.
        const { sendVerificationEmail } = createEmailSender(env as CloudflareEnv, baseURL);
        const result = await sendVerificationEmail({
          email: user.email,
          verificationUrl: url,
          userName: user.name,
        });
        if (!result.success) {
          console.error("[AUTH] Failed to send verification email:", result.error);
        }
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24, // 24 hours
    },
  });

  authInstanceCache.set(rawD1, auth);
  return auth;
}
