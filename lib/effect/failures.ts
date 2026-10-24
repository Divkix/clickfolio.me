import { Data } from "effect";

/**
 * What went wrong with a call to something external. `timeout` and `unavailable` may succeed
 * on a later attempt; `rejected` and `invalid-response` never will, so callers give up.
 */
export type UpstreamKind = "timeout" | "unavailable" | "rejected" | "invalid-response";

/** Both fields are logged: keep `operation` low-cardinality and `message` free of PII. */
export type UpstreamDetails = {
  readonly operation: string;
  readonly kind: UpstreamKind;
  readonly message: string;
  readonly cause?: unknown;
};

type Reason = { readonly message: string };

export class InvalidInput extends Data.TaggedError("InvalidInput")<
  Reason & { readonly details?: unknown; readonly cause?: unknown }
> {}

export class PayloadTooLarge extends Data.TaggedError("PayloadTooLarge")<Reason> {}

export class Unauthorized extends Data.TaggedError("Unauthorized")<Reason> {}

export class Forbidden extends Data.TaggedError("Forbidden")<Reason> {}

export class NotFound extends Data.TaggedError("NotFound")<Reason> {}

export class Conflict extends Data.TaggedError("Conflict")<Reason> {}

export class RateLimited extends Data.TaggedError("RateLimited")<
  Reason & { readonly retryAfterSeconds: number }
> {}

/** The limit store failed, so the request is refused rather than let through unmetered. */
export class RateLimitUnavailable extends Data.TaggedError("RateLimitUnavailable")<
  Reason & { readonly retryAfterSeconds: number }
> {}

/** Postgres unique violation (SQLSTATE 23505). */
export class DbConflict extends Data.TaggedError("DbConflict")<
  Reason & { readonly cause?: unknown }
> {}

export class DbFailed extends Data.TaggedError("DbFailed")<UpstreamDetails> {}

export class R2Failed extends Data.TaggedError("R2Failed")<UpstreamDetails> {}

export class ClerkFailed extends Data.TaggedError("ClerkFailed")<UpstreamDetails> {}

export class EmailFailed extends Data.TaggedError("EmailFailed")<UpstreamDetails> {}

export class QueueFailed extends Data.TaggedError("QueueFailed")<UpstreamDetails> {}

export class DurableObjectFailed extends Data.TaggedError("DurableObjectFailed")<UpstreamDetails> {}

export class WorkflowFailed extends Data.TaggedError("WorkflowFailed")<UpstreamDetails> {}

/** A third-party HTTP API; `host` is a fixed label such as "umami", never a URL. */
export class HttpUpstreamFailed extends Data.TaggedError("HttpUpstreamFailed")<
  UpstreamDetails & { readonly host: string }
> {}

export type UpstreamFailure =
  | DbFailed
  | R2Failed
  | ClerkFailed
  | EmailFailed
  | QueueFailed
  | DurableObjectFailed
  | WorkflowFailed
  | HttpUpstreamFailed;

export type ServerFailure =
  | UpstreamFailure
  | InvalidInput
  | PayloadTooLarge
  | Unauthorized
  | Forbidden
  | NotFound
  | Conflict
  | RateLimited
  | RateLimitUnavailable
  | DbConflict;
