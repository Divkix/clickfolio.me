import { createClerkClient, verifyToken } from "@clerk/backend";
import { Context, Effect, Layer } from "effect";
import { z } from "zod";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import { classifyUpstreamCause, externalCall } from "../external";
import { ClerkFailed, type UpstreamKind } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

export interface ClerkClaims {
  sub: string;
  sid?: string;
  orgId?: string;
  exp?: number;
  iat?: number;
}

// What a verified session JWT carries. A token Clerk signed with another shape is still not a
// session this app can use.
const payloadSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().optional(),
  org_id: z.string().optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
});

// `TokenVerificationError.reason` from @clerk/backend. Duck-typed: the SDK also surfaces plain
// network errors from its JWKS fetch, and those must not look like a bad token.
const verificationErrorSchema = z.object({ reason: z.string() });

// The visitor's token is at fault: expired, malformed, wrong signature, issuer or key id.
const TOKEN_FAULT_REASON = /^(?:token-|jwk-kid-mismatch$)/;

// Our side or Clerk's is at fault: bad or missing secret, JWKS unreachable or empty.
const CONFIG_FAULT_REASON = /^(?:secret-key-|jwk-failed-to-resolve$|jwk-local-missing$)/;

function tokenFault(cause: unknown): boolean {
  const parsed = verificationErrorSchema.safeParse(cause);

  return parsed.success && TOKEN_FAULT_REASON.test(parsed.data.reason);
}

function classifyClerkCause(cause: unknown): UpstreamKind {
  const parsed = verificationErrorSchema.safeParse(cause);

  if (parsed.success && CONFIG_FAULT_REASON.test(parsed.data.reason)) return "rejected";

  return classifyUpstreamCause(cause);
}

type Verification =
  | { readonly outcome: "verified"; readonly claims: ClerkClaims }
  | { readonly outcome: "rejected"; readonly cause: unknown };

// What `users.deleteUser` throws on a refusal: a ClerkAPIResponseError carries the HTTP status.
const httpStatusSchema = z.object({ status: z.number() });

const DELETE_USER_OPERATION = "clerk.delete-user";
const VERIFY_TOKEN_OPERATION = "clerk.verify-token";

/** A missing key is a deployment fault: retrying the same call cannot fix it. */
function missingSecret(operation: string): ClerkFailed {
  return new ClerkFailed({
    operation,
    kind: "rejected",
    message: "CLERK_SECRET_KEY is not configured",
  });
}

type ClerkService = {
  /**
   * Claims of a valid session token, or `null` when the token is expired, forged or malformed
   * (the visitor is signed out). Clerk or its key set being unreachable, or a missing or wrong
   * secret key, fails with `ClerkFailed` instead: an outage is not a sign-out.
   * The SDK fetches and caches the key set itself and may retry that fetch once; this call adds
   * the timeout and never retries.
   */
  readonly verifyToken: (token: string) => Effect.Effect<ClerkClaims | null, ClerkFailed>;
  /**
   * Deletes the Clerk identity. A user Clerk no longer has (404) counts as deleted, so a repeat
   * of a delete that landed after a timeout still succeeds. A missing secret key fails
   * non-retryable. Never retried here: the caller decides, and the `user.deleted` webhook
   * finishes local cleanup if the request cannot be repeated.
   */
  readonly deleteUser: (clerkId: string) => Effect.Effect<void, ClerkFailed>;
};

function deleteUserWith(secretKey: string | undefined): ClerkService["deleteUser"] {
  return (clerkId) => {
    if (!secretKey) {
      return Effect.fail(missingSecret(DELETE_USER_OPERATION));
    }

    return externalCall({
      operation: DELETE_USER_OPERATION,
      timeoutMs: TIMEOUT_MS.clerk,
      // The SDK takes no AbortSignal: a timeout stops the wait, not the request.
      run: async () => {
        try {
          await createClerkClient({ secretKey }).users.deleteUser(clerkId);
        } catch (cause) {
          const status = httpStatusSchema.safeParse(cause);

          if (status.success && status.data.status === 404) return;

          throw cause;
        }
      },
      fail: (details) => new ClerkFailed(details),
    });
  };
}

function service(secretKey: string | undefined): ClerkService {
  return {
    deleteUser: deleteUserWith(secretKey),
    verifyToken: (token) => {
      if (!token) return Effect.succeed(null);

      if (!secretKey) return Effect.fail(missingSecret(VERIFY_TOKEN_OPERATION));

      return externalCall({
        operation: VERIFY_TOKEN_OPERATION,
        timeoutMs: TIMEOUT_MS.clerk,
        run: async (): Promise<Verification> => {
          try {
            const payload = payloadSchema.safeParse(await verifyToken(token, { secretKey }));

            if (!payload.success) {
              return { outcome: "rejected", cause: payload.error };
            }

            const { sub, sid, org_id: orgId, exp, iat } = payload.data;

            return { outcome: "verified", claims: { sub, sid, orgId, exp, iat } };
          } catch (cause) {
            if (tokenFault(cause)) return { outcome: "rejected", cause };

            throw cause;
          }
        },
        fail: (details) => new ClerkFailed(details),
        classify: classifyClerkCause,
      }).pipe(
        Effect.map((verification) => {
          if (verification.outcome === "verified") return verification.claims;

          log("warn", "[clerk] session token verification failed", {
            ...errorFields(verification.cause),
          });

          return null;
        }),
      );
    },
  };
}

/**
 * Clerk session-token verification (`@clerk/backend`). A missing secret key does not fail the
 * layer: it fails each verification with a non-retryable `ClerkFailed`, so a request without a
 * token still answers "signed out" the way it always did.
 */
export class Clerk extends Context.Service<Clerk, ClerkService>()("clickfolio/Clerk") {
  static layer(env: CloudflareEnv): Layer.Layer<Clerk> {
    return Layer.sync(Clerk, () => service(env.CLERK_SECRET_KEY));
  }

  /**
   * For tests: swap the verification (and optionally the deletion) itself, no network and no
   * secret. Without `deleteUser`, deleting fails as not configured.
   */
  static layerFrom(
    verify: ClerkService["verifyToken"],
    deleteUser: ClerkService["deleteUser"] = deleteUserWith(undefined),
  ): Layer.Layer<Clerk> {
    return Layer.succeed(Clerk, { verifyToken: verify, deleteUser });
  }
}
