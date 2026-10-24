import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { Cause, Effect, Exit, Layer } from "effect";
import { z } from "zod";
import { Db } from "@/lib/effect/db";
import { runBackground } from "@/lib/effect/edges";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2Store } from "@/lib/effect/services/r2-store";
import { handleChanges, resumes, uploadRateLimits } from "@/lib/db/schema";
import { purgeR2Keys } from "@/lib/workflows/r2-purge";
import type { UnknownRecord } from "../types/json";
import { log, logEvent } from "../utils/log";
import { errorFields } from "../utils/error-fields";

const FAILED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const FAILED_RESUMES_BATCH = 100;

export interface CleanupResult extends UnknownRecord {
  ok: true;
  deleted: {
    rateLimits: number;
    handleChanges: number;
    failedResumes: number;
  };
  timestamp: string;
}

type CleanupEnv = Pick<
  CloudflareEnv,
  "HYPERDRIVE" | "CLICKFOLIO_R2_BUCKET" | "CLICKFOLIO_R2_DELETE_WORKFLOW"
>;

/** The wrapped driver error's name when there is one, so `errorType` keeps its meaning. */
function errorTypeOf(cause: unknown): string {
  return errorFields(cause instanceof Error && cause.cause ? cause.cause : cause)["error.name"];
}

const deleteResultSchema = z.object({ rowCount: z.number().nullish() });

// The generic Drizzle handle leaves the driver result untyped: read it through its contract.

const staleFailedAt = (cutoff: string) =>
  and(
    eq(resumes.status, "failed"),
    lt(sql`COALESCE(${resumes.updatedAt}, ${resumes.createdAt})`, cutoff),
  );

const deleteExpiredRows = (nowIso: string, ninetyDaysAgo: string) =>
  Db.use((service) =>
    service.transaction("cleanup.expired_rows", async (tx) => {
      const rateLimits = deleteResultSchema.parse(
        await tx.delete(uploadRateLimits).where(lt(uploadRateLimits.expiresAt, nowIso)),
      );

      const handleChangesDeleted = deleteResultSchema.parse(
        await tx.delete(handleChanges).where(lt(handleChanges.createdAt, ninetyDaysAgo)),
      );

      return {
        rateLimits: rateLimits.rowCount ?? 0,
        handleChanges: handleChangesDeleted.rowCount ?? 0,
      };
    }),
  );

/** Deletes stale `failed` resume rows first, then their R2 objects. Returns the rows deleted. */
const purgeStaleFailedResumes = Effect.gen(function* () {
  const cutoff = new Date(Date.now() - FAILED_TTL_MS).toISOString();

  const staleFailed = yield* Db.use((service) =>
    service.query("cleanup.select_stale_failed", (db) =>
      db
        .select({ id: resumes.id })
        .from(resumes)
        .where(staleFailedAt(cutoff))
        .limit(FAILED_RESUMES_BATCH),
    ),
  );

  if (staleFailed.length === 0) return 0;

  // Delete the rows first, guarded on still being stale `failed`, and use only the ids the
  // DELETE actually returned: a row that raced back into an active status (e.g. retry) keeps
  // both its DB row and its R2 object. R2 is touched only once the rows are durably gone.
  const deletedRows = yield* Db.use((service) =>
    service.query("cleanup.delete_stale_failed", (db) =>
      db
        .delete(resumes)
        .where(
          and(
            inArray(
              resumes.id,
              staleFailed.map((row) => row.id),
            ),
            staleFailedAt(cutoff),
          ),
        )
        .returning({ id: resumes.id, r2Key: resumes.r2Key }),
    ),
  );

  const r2Keys = deletedRows.flatMap((row) => (row.r2Key ? [row.r2Key] : []));

  // purgeR2Keys has already logged why; the rows are gone either way, so the count stands.
  if (r2Keys.length > 0) yield* purgeR2Keys(r2Keys).pipe(Effect.catch(() => Effect.void));

  return deletedRows.length;
});

const cleanup = Effect.gen(function* () {
  const nowIso = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const deleted = yield* deleteExpiredRows(nowIso, ninetyDaysAgo);

  const failedResumes = yield* purgeStaleFailedResumes.pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        log("error", "failed-resume auto-purge failed", { ...errorFields(error) });

        return 0;
      }),
    ),
  );

  const result: CleanupResult = {
    ok: true,
    deleted: { ...deleted, failedResumes },
    timestamp: nowIso,
  };

  return result;
});

/**
 * One cleanup run against `layer`, with one `cleanup_completed` or `cleanup_failed` event.
 * Rejects with the typed failure (or the defect) so the platform records a failed run;
 * callers log the error itself.
 */
export async function runCleanup(
  layer: Layer.Layer<Db | R2Store | R2DeleteScheduler>,
): Promise<CleanupResult> {
  const startedAt = Date.now();
  const exit = await runBackground(cleanup, layer);

  if (Exit.isSuccess(exit)) {
    const result = exit.value;

    logEvent("cleanup_completed", {
      duration_ms: Date.now() - startedAt,
      rate_limits_deleted: result.deleted.rateLimits,
      handle_changes_deleted: result.deleted.handleChanges,
      failed_resumes_deleted: result.deleted.failedResumes,
    });

    return result;
  }

  const cause = Cause.squash(exit.cause);

  logEvent(
    "cleanup_failed",
    { duration_ms: Date.now() - startedAt, errorType: errorTypeOf(cause) },
    "warn",
  );

  throw cause;
}

/** Daily cleanup for the scheduled handler and the cron route. */
export function performCleanup(env: CleanupEnv): Promise<CleanupResult> {
  // Built per run, so no pool or binding wrapper outlives the invocation.
  return runCleanup(
    Layer.mergeAll(Db.layer(env.HYPERDRIVE), R2Store.layer(env), R2DeleteScheduler.layer(env)),
  );
}
