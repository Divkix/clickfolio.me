import { and, asc, inArray, lt, sql } from "drizzle-orm";
import { Cause, Effect, Exit, Layer } from "effect";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runBackground } from "@/lib/effect/edges";
import { DbFailed } from "@/lib/effect/failures";
import { StatusChannel } from "@/lib/effect/services/status-channel";
import { notifyStatusBestEffort } from "@/lib/parse/notify-status";
import {
  STRANDED_PROCESSING_AFTER_MS,
  STRANDED_PROCESSING_MESSAGE,
  STRANDED_START_AFTER_MS,
  STRANDED_START_MESSAGE,
} from "@/lib/resume/lifecycle";
import { log, logEvent } from "@/lib/utils/log";

// Fails resume rows that stopped moving: a claim or workflow start that died after the row was
// written, or a parse run that never finished. Without it such a row shows "processing" forever,
// and a `pending_claim` one also blocks re-uploading the same file.

/** Rows failed per rule per attempt; a lost commit response can consume another batch on retry. */
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

/**
 * Each rule gets an invocation-local connection, with one fresh connection attempt after a
 * severed egress. Only the guarded DB update can fail: completed rules and status pushes are
 * never replayed. Rejects other failures so the platform records a failed run.
 */
export async function runStrandedSweep(
  layer: Layer.Layer<Db | StatusChannel>,
  batchSize: number = STRANDED_SWEEP_BATCH,
) {
  const runRule = async (rule: SweepRule) => {
    for (let attempt = 0; ; attempt++) {
      // A separate run builds the layer again, so a broken pg connection is never reused.
      const exit = await runBackground(failStranded(rule, batchSize), layer);

      if (Exit.isSuccess(exit)) return exit.value;

      const failure = Cause.squash(exit.cause);

      if (
        attempt !== 0 ||
        !(failure instanceof DbFailed) ||
        failure.kind !== "unavailable" ||
        failure.message !== "Egress connection severed outside of Hyperdrive"
      ) {
        throw failure;
      }

      // UPDATE repeats the status predicate: an unknown commit cannot transition the same row
      // twice. Only acknowledged RETURNING rows get best-effort notifications; never retry a
      // timeout (pg keeps running), a status push, or an arbitrary 58000 error.
      log("warn", "retrying stranded sweep after connection severed", {
        operation: rule.operation,
      });
    }
  };

  return {
    neverStarted: await runRule(NEVER_STARTED),
    timedOut: await runRule(PROCESSING_TIMEOUT),
  };
}

// The every-15-minutes cron tick.
export function performStrandedSweep(
  env: Pick<CloudflareEnv, "HYPERDRIVE" | "CLICKFOLIO_STATUS_DO">,
) {
  // Built per run, so no pool or binding wrapper outlives the invocation.
  return runStrandedSweep(Layer.mergeAll(Db.layer(env.HYPERDRIVE), StatusChannel.layer(env)));
}
