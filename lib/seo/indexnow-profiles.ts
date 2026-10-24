import { Effect } from "effect";
import { IndexNow } from "@/lib/effect/services/indexnow";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/**
 * Drops URLs pinged recently, submits the rest, and marks them only after an accepted
 * submission, so a rejected ping is retried on the next change instead of being suppressed. The
 * debounce is per-colo and best-effort: when it fails the ping goes ahead without it.
 */
export function submitProfiles(
  urls: string[],
  skipDebounce: boolean,
): Effect.Effect<void, never, IndexNow> {
  return Effect.gen(function* () {
    const indexNow = yield* IndexNow;

    // A change that takes a page out of search (hide, delete, rename) must reach the engines even
    // right after a publish ping, so it skips the read. It still marks the URL afterwards.
    const fresh = yield* (skipDebounce ? Effect.succeed(urls) : indexNow.undebounced(urls)).pipe(
      Effect.catchTag("IndexNowDebounceFailed", (failure) =>
        Effect.sync(() => {
          log("warn", "indexnow debounce unavailable", {
            operation: failure.operation,
            kind: failure.kind,
            ...errorFields(failure.cause ?? failure),
          });

          return urls;
        }),
      ),
    );

    if (fresh.length === 0) return;

    yield* indexNow.submit(fresh);
    yield* indexNow.markDebounced(fresh).pipe(
      Effect.catchTag("IndexNowDebounceFailed", (failure) =>
        Effect.sync(() => {
          log("warn", "indexnow debounce write failed", {
            operation: failure.operation,
            kind: failure.kind,
            ...errorFields(failure.cause ?? failure),
          });
        }),
      ),
    );
    log("info", "indexnow submitted", { url_count: fresh.length });
  }).pipe(
    Effect.catchTag("HttpUpstreamFailed", (failure) =>
      Effect.sync(() => {
        log("warn", "indexnow submission failed", {
          operation: failure.operation,
          kind: failure.kind,
          host: failure.host,
          ...errorFields(failure.cause ?? failure),
        });
      }),
    ),
  );
}
