/**
 * Server-side Better Auth configuration for Next.js 16 with Cloudflare D1
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
 * - Development: process.env (via .env.local)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/resend";
import { generateReferralCode } from "@/lib/utils/referral-code";

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
const authInstanceCache = new WeakMap<D1Database, ReturnType<typeof betterAuth>>();

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
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return (query: string) => {
          const stmt = target.prepare(query);
          return new Proxy(stmt, {
            get(stmtTarget, stmtProp, stmtReceiver) {
              if (stmtProp === "bind") {
                return (...args: unknown[]) => {
                  const serializedArgs = args.map((arg) =>
                    arg instanceof Date ? arg.toISOString() : arg,
                  );
                  return stmtTarget.bind(...serializedArgs);
                };
              }
              const value = Reflect.get(stmtTarget, stmtProp, stmtReceiver);
              return typeof value === "function" ? value.bind(stmtTarget) : value;
            },
          });
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  d1ProxyCache.set(d1, proxy);
  return proxy;
}

/**
 * Get env value with Cloudflare binding fallback to process.env
 */
function getEnvValue(env: Partial<CloudflareEnv>, key: keyof CloudflareEnv): string {
  const cfValue = env[key];
  if (typeof cfValue === "string" && cfValue.trim() !== "") {
    return cfValue;
  }
  const processValue = process.env[key];
  if (processValue && processValue.trim() !== "") {
    return processValue;
  }
  throw new Error(
    `Missing required environment variable: ${key}. ` +
      `Set it via .env.local (dev) or 'wrangler secret put ${key}' (prod).`,
  );
}

/**
 * Creates (or returns a cached) Better Auth instance for the current isolate's
 * D1 binding.
 *
 * The instance is cached in a module-level WeakMap keyed by the raw D1 binding
 * object. Within a Cloudflare Workers isolate, `env.DB` is the same object
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
  const { env } = await getCloudflareContext({ async: true });
  const rawD1 = env.DB;

  // Fast path: return cached instance if we already built one for this binding
  const cached = authInstanceCache.get(rawD1);
  if (cached) return cached;

  // Slow path: first request in this isolate -- build everything once
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
          defaultValue:
            '{"show_phone":false,"show_address":false,"hide_from_search":false,"show_in_directory":true}',
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
      // Allow localhost dev servers (Next.js dev + Workers preview)
      "http://localhost:3000",
      "http://localhost:8787",
      // Production domains
      "https://clickfolio.me",
      "https://www.clickfolio.me",
      // Allow HTTP variant for local DNS testing (clickfolio.me → 127.0.0.1)
      "http://clickfolio.me",
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
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
