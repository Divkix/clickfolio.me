import { RateLimitUnavailable, type DbConflict, type DbFailed } from "@/lib/effect/failures";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

const UNAVAILABLE_RETRY_SECONDS = 60;

/**
 * Every limiter fails closed: when its store cannot be read or written, the request is refused
 * (503 + Retry-After) because answering "allowed" would meter nothing. `limiter` is a fixed
 * label; the log carries the scrubbed cause but never an address or a user id.
 */
export function storeDown(limiter: string, message: string) {
  return (failure: DbFailed | DbConflict): RateLimitUnavailable => {
    log("error", "Rate limit store failed", {
      limiter,
      ...errorFields(failure.cause ?? failure),
    });

    return new RateLimitUnavailable({ message, retryAfterSeconds: UNAVAILABLE_RETRY_SECONDS });
  };
}
