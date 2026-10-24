import { Effect, Result } from "effect";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2Store } from "@/lib/effect/services/r2-store";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/**
 * Deletes `keys` now and hands any key that failed to R2DeleteWorkflow, which retries it.
 * Succeeds with the keys that were handed over. Fails (after logging) only when R2 and the
 * workflow are both unreachable, which leaves the objects behind: callers must surface that.
 * Repeating a delete is harmless, so scheduling after a timed-out delete cannot duplicate anything.
 */
export function purgeR2Keys(keys: readonly string[]) {
  return Effect.gen(function* () {
    const store = yield* R2Store;
    const scheduler = yield* R2DeleteScheduler;

    const results = yield* Effect.forEach(keys, (key) => Effect.result(store.delete(key)), {
      concurrency: "unbounded",
    });

    const failures = results.flatMap((result, index) =>
      Result.isFailure(result) ? [{ key: keys[index], error: result.failure }] : [],
    );

    if (failures.length === 0) return [];

    const failedKeys = failures.map((failure) => failure.key);

    // Counts, not keys: every key ends in the uploaded file name.
    log("warn", "R2 delete failed; retrying in R2DeleteWorkflow", {
      keyCount: failedKeys.length,
      ...errorFields(failures[0].error),
    });

    yield* scheduler.schedule({ keys: failedKeys }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() =>
          log("error", "failed to schedule R2 deletion", {
            keyCount: failedKeys.length,
            ...errorFields(error),
          }),
        ),
      ),
    );

    return failedKeys;
  });
}
