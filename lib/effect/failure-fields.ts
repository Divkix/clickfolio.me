import type { UnknownRecord } from "@/lib/types/json";
import { errorFields } from "@/lib/utils/error-fields";
import type { UpstreamFailure } from "./failures";

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
