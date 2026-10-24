import { Effect } from "effect";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { CareerProfile } from "../ai/career";
import { resumes } from "../db/schema";
import { Db } from "../effect/db";
import { upstreamLogFields } from "../effect/failure-fields";
import { DbFailed, type DbConflict, type R2Failed } from "../effect/failures";
import {
  R2_BINDING_MISSING_MESSAGE,
  R2ObjectMissing as R2KeyMissing,
  R2Store,
} from "../effect/services/r2-store";
import { buildWaitingForCacheTimeoutUpdate } from "../resume/lifecycle";
import { completeResumes } from "../resume/completion";
import type { UnknownRecord } from "../types/json";
import type { ResumeContent } from "../types/database";
import { parseFailureAlertBestEffort, type AlertChannel } from "./alert";
import { classifyParseError, readStoredParseError, type ParseErrorJson } from "./errors";
import {
  DbUnavailable,
  R2BindingMissing,
  R2ObjectMissing,
  R2Throttled,
  toParseErrorJson,
  type ParseFailure,
} from "./failures";
import { notifyStatusBestEffort } from "./notify-status";
import { log } from "../utils/log";
import { errorFields } from "../utils/error-fields";

// Step bodies of ResumeParseWorkflow (lib/workflows/resume-parse-workflow.ts).
// Each one is safe to re-run: the workflow retries a step until it returns, and
// replays completed steps from their stored result instead of re-running them.
// They only describe the work: the workflow runs each one inside `step.do` through
// `runWorkflowStep`, with the layers `parseWorkflowLayer` builds for that step.

export type ResumeParseJob = {
  resumeId: string;
  userId: string;
  r2Key: string;
  fileHash: string;
  /**
   * The row's `retry_count` when this run was started. A run whose count no longer matches was
   * superseded by a sweep and a manual retry: it must not claim the row, count an attempt on it,
   * record a failure on it or fail it. Absent on runs started before the field existed, which
   * skip the check.
   */
  retryCount?: number;
};

/** The row this run owns: its id, and its retry count when the run recorded one. */
function ownsRow(job: ResumeParseJob) {
  return and(
    eq(resumes.id, job.resumeId),
    job.retryCount === undefined ? undefined : eq(resumes.retryCount, job.retryCount),
  );
}

export type ParsedResume = {
  parsedContent: ResumeContent;
  career: CareerProfile | null;
};

const GENERIC_ERROR_MESSAGE = "Something went wrong while parsing your resume. Please try again.";

function dbLogFields(failure: DbFailed | DbConflict): UnknownRecord {
  if (failure instanceof DbFailed) return upstreamLogFields(failure);

  return { failure: failure._tag, ...errorFields(failure.cause ?? failure.message) };
}

/**
 * The failure a step stores when its retries run out. `mark failed` reads the wire type from the
 * thrown error's cause, so a database failure keeps the `db_connection_error` /
 * `parse_validation_error` types it was stored under before the steps were typed: an outage maps
 * to `DbUnavailable` (retried), anything else goes through the classifier on the original cause.
 */
function toParseFailure(failure: DbFailed | DbConflict): ParseFailure {
  if (
    failure instanceof DbFailed &&
    (failure.kind === "timeout" || failure.kind === "unavailable")
  ) {
    return new DbUnavailable({ message: failure.message, cause: failure.cause });
  }

  return classifyParseError(failure.cause ?? failure);
}

function asParseFailure<A, R>(program: Effect.Effect<A, DbFailed | DbConflict, R>) {
  return program.pipe(
    Effect.tapError((failure) =>
      Effect.sync(() => log("warn", "resume parse database step failed", dbLogFields(failure))),
    ),
    Effect.mapError(toParseFailure),
  );
}

function logAndDrop(message: string, fields: UnknownRecord) {
  return (failure: DbFailed | DbConflict) =>
    Effect.sync(() => log("error", message, { ...fields, ...dbLogFields(failure) }));
}

/**
 * Moves the row to `processing`, or completes it from an identical earlier parse.
 * `skipped` means the row is gone, already completed, or not in a parseable state.
 */
export function claimResumeForParse(job: ResumeParseJob) {
  return Effect.gen(function* () {
    const [currentResume, cached] = yield* Effect.all(
      [
        Db.use((db) =>
          db.query("parse.claim.status", (handle) =>
            handle
              .select({ status: resumes.status })
              .from(resumes)
              .where(eq(resumes.id, job.resumeId))
              .limit(1),
          ),
        ),
        Db.use((db) =>
          db.query("parse.claim.cached", (handle) =>
            handle
              .select({ parsedContent: resumes.parsedContent })
              .from(resumes)
              .where(
                and(
                  eq(resumes.userId, job.userId),
                  eq(resumes.fileHash, job.fileHash),
                  eq(resumes.status, "completed"),
                  isNotNull(resumes.parsedContent),
                  ne(resumes.id, job.resumeId),
                ),
              )
              .limit(1),
          ),
        ),
      ],
      { concurrency: 2 },
    );

    if (!currentResume[0] || currentResume[0].status === "completed") {
      log("info", "resume missing or already completed, skipping parse", {
        resumeId: job.resumeId,
      });

      return "skipped" as const;
    }

    // `processing` is included so a re-run of this step after a lost response
    // still claims the row it already moved.
    const claimed = yield* Db.use((db) =>
      db.query("parse.claim.update", (handle) =>
        handle
          .update(resumes)
          .set({ status: "processing", queuedAt: new Date().toISOString() })
          .where(
            and(ownsRow(job), inArray(resumes.status, ["queued", "pending_claim", "processing"])),
          )
          .returning({ id: resumes.id }),
      ),
    );

    if (claimed.length === 0) {
      log("info", "resume not claimable in current status or retry, skipping", {
        resumeId: job.resumeId,
      });

      return "skipped" as const;
    }

    if (cached[0]?.parsedContent) {
      // Same user + same file: career was already classified on the original parse.
      yield* completeResumes({
        items: [{ resumeId: job.resumeId, userId: job.userId }],
        // SAFETY: cached parsedContent is schema-validated ResumeContent written by a prior completion; cast bridges the column's wide Record type.
        parsedContent: cached[0].parsedContent as ResumeContent,
        retryCount: job.retryCount,
      });

      return "cached" as const;
    }

    yield* notifyStatusBestEffort({ resumeId: job.resumeId, status: "processing" });

    return "parse" as const;
  }).pipe(asParseFailure);
}

/** A key the bucket does not have, or a bucket that is not bound, will not appear on a retry. */
function toR2ParseFailure(
  failure: R2Failed | R2KeyMissing,
): R2ObjectMissing | R2BindingMissing | R2Throttled {
  // The store's R2ObjectMissing is a different class from the parse one of the same name.
  if (failure instanceof R2KeyMissing) {
    // No key in the message: it ends in the uploader's file name, and the message is logged.
    return new R2ObjectMissing({ message: "Failed to fetch PDF from R2" });
  }

  if (failure.message === R2_BINDING_MISSING_MESSAGE) {
    return new R2BindingMissing({ message: "R2 binding not available", cause: failure });
  }

  return new R2Throttled({ message: failure.message, cause: failure.cause ?? failure });
}

/** One replay-safe parse attempt; the Workflow adapter owns retries. */
export function parseResumePdf(job: ResumeParseJob, env: CloudflareEnv) {
  return Effect.gen(function* () {
    const recordFailure = (failure: ParseFailure) => {
      const dropFailure = logAndDrop("failed to record parse attempt", {
        resumeId: job.resumeId,
      });

      return Db.use((db) =>
        db.query("parse.record_failure", (handle) =>
          handle
            .update(resumes)
            .set({
              errorMessage: failure.userMessage,
              lastAttemptError: JSON.stringify(toParseErrorJson(failure)),
            })
            .where(and(ne(resumes.status, "completed"), ownsRow(job))),
        ),
      ).pipe(Effect.catchTags({ DbFailed: dropFailure, DbConflict: dropFailure }));
    };

    const attempt = yield* asParseFailure(
      Db.use((db) =>
        db.query("parse.attempt", (handle) =>
          handle
            .update(resumes)
            .set({ totalAttempts: sql`${resumes.totalAttempts} + 1` })
            .where(and(ownsRow(job), eq(resumes.status, "processing")))
            .returning({ id: resumes.id }),
        ),
      ),
    );

    if (attempt.length === 0) {
      log("info", "resume no longer processing, skipping parse attempt", {
        resumeId: job.resumeId,
      });

      return null;
    }

    return yield* Effect.gen(function* () {
      const pdfBytes = yield* R2Store.use((store) => store.get(job.r2Key)).pipe(
        Effect.mapError(toR2ParseFailure),
      );

      // parseResumeWithAi takes a plain ArrayBuffer; `slice()` is a Uint8Array over exactly the PDF.
      const pdfBuffer = pdfBytes.slice().buffer;
      const { parseResumeWithAi } = yield* Effect.promise(() => import("../ai"));
      const parsedContent = yield* parseResumeWithAi(pdfBuffer, env);
      const { classifyCareerEffect } = yield* Effect.promise(() => import("../ai/career"));
      const career = yield* classifyCareerEffect(parsedContent, env);

      return { parsedContent, career };
    }).pipe(
      Effect.tapError(recordFailure),
      Effect.tapDefect((cause) => recordFailure(classifyParseError(cause))),
    );
  });
}

/** Read inside the retryable terminal step, including after a Workflow replay. */
export function readLastParseFailure(job: ResumeParseJob) {
  return Db.use((db) =>
    db.query("parse.read_failure", (handle) =>
      handle
        .select({ lastAttemptError: resumes.lastAttemptError })
        .from(resumes)
        .where(eq(resumes.id, job.resumeId))
        .limit(1),
    ),
  ).pipe(
    Effect.map(([row]): ParseErrorJson | null =>
      readStoredParseError(row?.lastAttemptError ?? null),
    ),
  );
}

/**
 * Marks the row completed and fans the result out to identical uploads waiting on it. Resolves to
 * the handles whose public site-data was rewritten, so the run can refresh their public pages.
 */
export function completeParsedResume(job: ResumeParseJob, parsed: ParsedResume) {
  return Effect.gen(function* () {
    // `?? null`: results persisted by a workflow step from before `career` existed.
    const career = parsed.career ?? null;

    const handles = new Set(
      yield* completeResumes({
        items: [{ resumeId: job.resumeId, userId: job.userId }],
        parsedContent: parsed.parsedContent,
        career,
        retryCount: job.retryCount,
      }),
    );

    const waitingResumes = yield* Db.use((db) =>
      db.query("parse.complete.waiting", (handle) =>
        handle
          .select({ id: resumes.id, userId: resumes.userId })
          .from(resumes)
          .where(
            and(
              eq(resumes.userId, job.userId),
              eq(resumes.fileHash, job.fileHash),
              eq(resumes.status, "waiting_for_cache"),
            ),
          ),
      ),
    );

    if (waitingResumes.length > 0) {
      const fanned = yield* completeResumes({
        items: waitingResumes.map((w) => ({ resumeId: w.id, userId: w.userId })),
        parsedContent: parsed.parsedContent,
        career,
        fanOut: true,
      });

      for (const handle of fanned) handles.add(handle);
    }

    return [...handles];
  }).pipe(asParseFailure);
}

/**
 * Terminal failure: every retry is spent or the error is permanent. The status pushes and the
 * alert are best effort, so only a database failure fails the step (and Workflows retries it).
 */
export function markResumeParseFailed(
  job: ResumeParseJob,
  storedError: ParseErrorJson,
  alertChannel: AlertChannel,
) {
  return Effect.gen(function* () {
    const failed = yield* Db.use((db) =>
      db.query("parse.mark_failed", (handle) =>
        handle
          .update(resumes)
          .set({
            status: "failed",
            errorMessage: sql`COALESCE(${resumes.errorMessage}, ${GENERIC_ERROR_MESSAGE})`,
            lastAttemptError: JSON.stringify(storedError),
            updatedAt: new Date().toISOString(),
          })
          .where(and(ne(resumes.status, "completed"), ownsRow(job)))
          .returning({
            totalAttempts: resumes.totalAttempts,
            errorMessage: resumes.errorMessage,
          }),
      ),
    );

    // Row gone (account deletion cascade) or completed elsewhere: nothing to report.
    if (failed.length === 0) return;

    yield* notifyStatusBestEffort({
      resumeId: job.resumeId,
      status: "failed",
      error: storedError.message,
    });

    // Identical uploads waiting on this parse would otherwise sit until their
    // waiting_for_cache timer and report a misleading timeout.
    const waitingFailed = yield* Db.use((db) =>
      db.query("parse.mark_failed.waiting", (handle) =>
        handle
          .update(resumes)
          .set({
            status: "failed",
            errorMessage: failed[0].errorMessage ?? GENERIC_ERROR_MESSAGE,
            lastAttemptError: JSON.stringify(storedError),
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(resumes.userId, job.userId),
              eq(resumes.fileHash, job.fileHash),
              eq(resumes.status, "waiting_for_cache"),
            ),
          )
          .returning({ id: resumes.id }),
      ),
    );

    yield* Effect.forEach(
      waitingFailed,
      (row) =>
        notifyStatusBestEffort({
          resumeId: row.id,
          status: "failed",
          error: storedError.message,
        }),
      { concurrency: 10, discard: true },
    );

    yield* parseFailureAlertBestEffort(
      {
        resumeId: job.resumeId,
        userId: job.userId,
        failureReason: storedError.message,
        errorType: storedError.type,
        totalAttempts: failed[0].totalAttempts ?? 0,
        timestamp: new Date().toISOString(),
      },
      alertChannel,
    );
  });
}

/** Persists the waiting_for_cache timeout if no identical parse completed the row in time. */
export function expireWaitingForCache(resumeId: string) {
  return Effect.gen(function* () {
    const expired = yield* Db.use((db) =>
      db.query("parse.expire_waiting", (handle) =>
        handle
          .update(resumes)
          .set(buildWaitingForCacheTimeoutUpdate())
          .where(and(eq(resumes.id, resumeId), eq(resumes.status, "waiting_for_cache")))
          .returning({ id: resumes.id }),
      ),
    );

    if (expired.length === 0 && !(yield* expiredByThisTimer(resumeId))) return false;

    // Also reached by a retry whose first attempt committed the UPDATE: notifying again is harmless.
    yield* notifyStatusBestEffort({
      resumeId,
      status: "failed",
      error: buildWaitingForCacheTimeoutUpdate().errorMessage,
    });

    return true;
  });
}

/**
 * Workflows retries this step until it returns, so an attempt that committed the UPDATE and
 * was lost before returning meets a row that is already failed. Answering "resolved" there would
 * skip the failure email for good. Only the timeout message with no stored parse error identifies
 * the row as ours: a row failed by the parse it waited on was already mailed by that run.
 */
function expiredByThisTimer(resumeId: string) {
  return Db.use((db) =>
    db.query("parse.expire_waiting.check", (handle) =>
      handle
        .select({
          status: resumes.status,
          errorMessage: resumes.errorMessage,
          lastAttemptError: resumes.lastAttemptError,
        })
        .from(resumes)
        .where(eq(resumes.id, resumeId))
        .limit(1),
    ),
  ).pipe(
    Effect.map(([row]) => {
      const timeout = buildWaitingForCacheTimeoutUpdate();

      // The timer never writes lastAttemptError; the parse failure fan-out always does, and it can
      // copy a stale timeout message onto its waiting rows.
      return (
        row?.status === timeout.status &&
        row.errorMessage === timeout.errorMessage &&
        row.lastAttemptError === null
      );
    }),
  );
}
