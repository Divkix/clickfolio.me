import type { UnknownRecord } from "@/lib/types/json";
import { errorFields } from "@/lib/utils/error-fields";
import type { ServerFailure, UpstreamFailure } from "./failures";

/**
 * Log fields for a failure that best-effort code recovered from: which dependency, which
 * operation, what kind, plus the scrubbed cause. A timeout means the call may still have
 * landed, so it is flagged for whoever reads the log (nothing retries a timed-out write).
 */
export function upstreamLogFields(failure: UpstreamFailure): UnknownRecord {
  const fields: UnknownRecord = {
    failure: failure._tag,
    operation: failure.operation,
    kind: failure.kind,
  };

  if (failure.kind === "timeout") fields.outcome_unknown = true;

  if (failure.cause !== undefined) Object.assign(fields, errorFields(failure.cause));
  else fields["error.message"] = failure.message;

  return fields;
}

/**
 * The scrubbed detail every logger adds to a typed failure: an upstream failure carries its
 * operation, kind and timeout flag; anything else carries its cause, or its own message when
 * there is none. `Data.TaggedError` only creates a `cause` key when one was given.
 */
export function failureDetailFields(failure: ServerFailure): UnknownRecord {
  if ("operation" in failure) return upstreamLogFields(failure);

  if ("cause" in failure && failure.cause !== undefined) return errorFields(failure.cause);

  return { "error.message": failure.message };
}
