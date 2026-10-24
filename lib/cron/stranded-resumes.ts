import { and, asc, inArray, lt, sql } from "drizzle-orm";
import { Cause, Effect, Exit, Layer } from "effect";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runBackground } from "@/lib/effect/edges";
import { StatusChannel } from "@/lib/effect/services/status-channel";
import { notifyStatusBestEffort } from "@/lib/parse/notify-status";
import {
  STRANDED_PROCESSING_AFTER_MS,
  STRANDED_PROCESSING_MESSAGE,
  STRANDED_START_AFTER_MS,
  STRANDED_START_MESSAGE,
} from "@/lib/resume/lifecycle";
import { logEvent } from "@/lib/utils/log";

// Fails resume rows that stopped moving: a claim or workflow start that died after the row was
// written, or a parse run that never finished. Without it such a row shows "processing" forever,
// and a `pending_claim` one also blocks re-uploading the same file.

/** Rows failed per rule per tick; the next tick takes the rest. */
export const STRANDED_SWEEP_BATCH = 100;

const NOTIFY_CONCURRENCY = 10;

export type SweepReason = "never_started" | "processing_timeout";

type SweepRule = {
  readonly reason: SweepReason;
  readonly operation: string;
  readonly statuses: ReadonlyArray<"pending_claim" | "queued" | "processing">;
  readonly afterMs: number;
  readonly message: string;
};

const NEVER_STARTED: SweepRule = {
  reason: "never_started",
  operation: "cron.stranded.never_started",
  statuses: ["pending_claim", "queued"],
  afterMs: STRANDED_START_AFTER_MS,
  message: STRANDED_START_MESSAGE,
};

const PROCESSING_TIMEOUT: SweepRule = {
  reason: "processing_timeout",
  operation: "cron.stranded.processing_timeout",
  statuses: ["processing"],
  afterMs: STRANDED_PROCESSING_AFTER_MS,
  message: STRANDED_PROCESSING_MESSAGE,
};

/**
 * One status-guarded `UPDATE ... RETURNING` per rule. The age is compared in SQL against the
 * database clock. The inner SELECT only picks the oldest batch; the outer UPDATE repeats the
 * status and age test so only rows that are still stale are written. `updated_at` is stamped so
 * the three-day failed-row cleanup counts from now.
 */
function failStranded(rule: SweepRule, batchSize: number) {
  const ageStart = sql`COALESCE(${resumes.queuedAt}, ${resumes.createdAt})`;
  const cutoff = sql`now() - make_interval(secs => ${rule.afterMs / 1000})`;
  const stale = and(inArray(resumes.status, [...rule.statuses]), lt(ageStart, cutoff));

  return Db.use((service) =>
    service.query(rule.operation, (db) =>
      db
        .update(resumes)
        .set({ status: "failed", errorMessage: rule.message, updatedAt: sql`now()` })
        .where(
          and(
            inArray(
              resumes.id,
              db
                .select({ id: resumes.id })
                .from(resumes)
                .where(stale)
                .orderBy(asc(ageStart))
                .limit(batchSize),
            ),
            stale,
          ),
        )
        .returning({ id: resumes.id }),
    ),
  ).pipe(
    Effect.flatMap((rows) =>
      Effect.forEach(
        rows,
        ({ id }) => {
          logEvent("resume_swept", { resumeId: id, reason: rule.reason }, "warn");

          // No email: the row is retryable, and the visitor sees the message on the status page.
          return notifyStatusBestEffort({
            resumeId: id,
            status: "failed",
            error: rule.message,
          });
        },
        { concurrency: NOTIFY_CONCURRENCY, discard: true },
      ).pipe(Effect.as(rows.length)),
    ),
  );
}

export function sweepStrandedResumes(batchSize: number = STRANDED_SWEEP_BATCH) {
  return Effect.gen(function* () {
    const neverStarted = yield* failStranded(NEVER_STARTED, batchSize);
    const timedOut = yield* failStranded(PROCESSING_TIMEOUT, batchSize);

    return { neverStarted, timedOut };
  });
}

/**
 * One sweep against `layer`. Rejects with the typed failure (or the defect) so the platform
 * records a failed run; the scheduled handler logs the error itself.
 */
export async function runStrandedSweep(
  layer: Layer.Layer<Db | StatusChannel>,
  batchSize: number = STRANDED_SWEEP_BATCH,
) {
  const exit = await runBackground(sweepStrandedResumes(batchSize), layer);

  if (Exit.isSuccess(exit)) return exit.value;

  throw Cause.squash(exit.cause);
}

// The every-15-minutes cron tick.
export function performStrandedSweep(
  env: Pick<CloudflareEnv, "HYPERDRIVE" | "CLICKFOLIO_STATUS_DO">,
) {
  // Built per run, so no pool or binding wrapper outlives the invocation.
  return runStrandedSweep(Layer.mergeAll(Db.layer(env.HYPERDRIVE), StatusChannel.layer(env)));
}
