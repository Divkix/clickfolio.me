import { Match } from "effect";
import { ERROR_CODES } from "@/lib/utils/security-headers";
import type { ServerFailure, UpstreamKind } from "./failures";

export type FailureDescription = {
  readonly status: number;
  readonly code: string;
  /** Safe to show the visitor: never carries a cause, SQL, a key or an address. */
  readonly userMessage: string;
  /** Whether the same call may succeed later. Whoever owns retries decides whether to retry. */
  readonly retryable: boolean;
  readonly logLevel: "warn" | "error";
  readonly retryAfterSeconds?: number;
};

const UPSTREAM_STATUS: Record<UpstreamKind, number> = {
  timeout: 504,
  unavailable: 503,
  rejected: 500,
  "invalid-response": 502,
};

const UPSTREAM_MESSAGE: Record<UpstreamKind, string> = {
  timeout: "The service took too long to respond. Please try again.",
  unavailable: "The service is temporarily unavailable. Please try again.",
  rejected: "An unexpected error occurred. Please try again.",
  "invalid-response": "The service returned an unexpected response. Please try again.",
};

function describeUpstream(kind: UpstreamKind, code: string): FailureDescription {
  return {
    status: UPSTREAM_STATUS[kind],
    code,
    userMessage: UPSTREAM_MESSAGE[kind],
    retryable: kind === "timeout" || kind === "unavailable",
    logLevel: "error",
  };
}

function describeClient(status: number, code: string, userMessage: string): FailureDescription {
  return { status, code, userMessage, retryable: false, logLevel: "warn" };
}

/** Every failure answers: which status and code, what to tell the visitor, retry or not, how loud. */
export const describeFailure: (failure: ServerFailure) => FailureDescription =
  Match.type<ServerFailure>().pipe(
    Match.tagsExhaustive({
      InvalidInput: (f) => describeClient(400, ERROR_CODES.VALIDATION_ERROR, f.message),
      PayloadTooLarge: (f) => describeClient(413, ERROR_CODES.BAD_REQUEST, f.message),
      Unauthorized: (f) => describeClient(401, ERROR_CODES.UNAUTHORIZED, f.message),
      Forbidden: (f) => describeClient(403, ERROR_CODES.FORBIDDEN, f.message),
      NotFound: (f) => describeClient(404, ERROR_CODES.NOT_FOUND, f.message),
      Conflict: (f) => describeClient(409, ERROR_CODES.CONFLICT, f.message),
      DbConflict: (f) => describeClient(409, ERROR_CODES.CONFLICT, f.message),
      RateLimited: (f) => ({
        ...describeClient(429, ERROR_CODES.RATE_LIMIT_EXCEEDED, f.message),
        retryAfterSeconds: f.retryAfterSeconds,
      }),
      RateLimitUnavailable: (f): FailureDescription => ({
        status: 503,
        code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        userMessage: f.message,
        retryable: true,
        logLevel: "error",
        retryAfterSeconds: f.retryAfterSeconds,
      }),
      DbFailed: (f) => describeUpstream(f.kind, ERROR_CODES.DATABASE_ERROR),
      R2Failed: (f) => describeUpstream(f.kind, ERROR_CODES.EXTERNAL_SERVICE_ERROR),
      ClerkFailed: (f) => describeUpstream(f.kind, ERROR_CODES.EXTERNAL_SERVICE_ERROR),
      EmailFailed: (f) => describeUpstream(f.kind, ERROR_CODES.EXTERNAL_SERVICE_ERROR),
      QueueFailed: (f) => describeUpstream(f.kind, ERROR_CODES.EXTERNAL_SERVICE_ERROR),
      DurableObjectFailed: (f) => describeUpstream(f.kind, ERROR_CODES.EXTERNAL_SERVICE_ERROR),
      WorkflowFailed: (f) => describeUpstream(f.kind, ERROR_CODES.EXTERNAL_SERVICE_ERROR),
      HttpUpstreamFailed: (f) => describeUpstream(f.kind, ERROR_CODES.EXTERNAL_SERVICE_ERROR),
    }),
  );
