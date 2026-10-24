import { Effect } from "effect";
import { z } from "zod";
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { CareerProfile } from "../ai/career";
import { resumes } from "../db/schema";
import { getDb, type Database } from "../db";
import { getR2Binding, R2 } from "../r2";
import { buildWaitingForCacheTimeoutUpdate } from "../resume/lifecycle";
import { completeResumes } from "../resume/completion";
import type { ResumeContent } from "../types/database";
import { getAlertChannel, sendAlert, type AlertEnv } from "./alert";
import { classifyParseError, readStoredParseError, type ParseErrorJson } from "./errors";
import {
  R2BindingMissing,
  R2ObjectMissing,
  R2Throttled,
  toParseErrorJson,
  type ParseFailure,
} from "./failures";
import { notifyStatusChange } from "./notify-status";
import { log } from "../utils/log";
import { errorFields } from "../utils/error-fields";

// Step bodies of ResumeParseWorkflow (lib/workflows/resume-parse-workflow.ts).
// Each one is safe to re-run: the workflow retries a step until it returns, and
// replays completed steps from their stored result instead of re-running them.

export type ResumeParseJob = {
  resumeId: string;
  userId: string;
  r2Key: string;
  fileHash: string;
};

export type ParseClaimOutcome = "parse" | "cached" | "skipped";

export type ParsedResume = {
  parsedContent: ResumeContent;
  career: CareerProfile | null;
};

const GENERIC_ERROR_MESSAGE = "Something went wrong while parsing your resume. Please try again.";

async function ignoreAndLog(task: () => Promise<void>, message: string): Promise<void> {
  try {
    await task();
  } catch (cause) {
    log("error", message, errorFields(cause));
  }
}

function r2Failure(cause: unknown): R2ObjectMissing | R2BindingMissing | R2Throttled {
  const parsed = z
    .object({
      message: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      status: z.number().optional(),
    })
    .safeParse(cause);

  const message =
    cause instanceof Error
      ? cause.message
      : parsed.success
        ? (parsed.data.message ?? String(cause))
        : String(cause);

  const code = parsed.success ? `${parsed.data.code ?? ""} ${parsed.data.name ?? ""}` : "";

  if (
    (parsed.success && parsed.data.status === 404) ||
    /NoSuchKey|no such key|object.*not.*found|key.*not.*found|file.*not.*found|object.*does.*not.*exist|\b404\b/i.test(
      `${code} ${message}`,
    )
  ) {
    return new R2ObjectMissing({ message, cause });
  }

  if (/binding.*not.*available|binding.*not.*found|MissingBinding/i.test(`${code} ${message}`)) {
    return new R2BindingMissing({ message, cause });
  }

  return new R2Throttled({ message, cause });
}

/**
 * Moves the row to `processing`, or completes it from an identical earlier parse.
 * `skipped` means the row is gone, already completed, or not in a parseable state.
 */
export async function claimResumeForParse(
  job: ResumeParseJob,
  env: CloudflareEnv,
): Promise<ParseClaimOutcome> {
  const db = getDb(env.HYPERDRIVE);

  const [currentResume, cached] = await Promise.all([
    db
      .select({ status: resumes.status })
      .from(resumes)
      .where(eq(resumes.id, job.resumeId))
      .limit(1),

    db
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
  ]);

  if (!currentResume[0] || currentResume[0].status === "completed") {
    log("info", "resume missing or already completed, skipping parse", {
      resumeId: job.resumeId,
    });

    return "skipped";
  }

  // `processing` is included so a re-run of this step after a lost response
  // still claims the row it already moved.
  const claimed = await db
    .update(resumes)
    .set({ status: "processing", queuedAt: new Date().toISOString() })
    .where(
      and(
        eq(resumes.id, job.resumeId),
        inArray(resumes.status, ["queued", "pending_claim", "processing"]),
      ),
    )
    .returning({ id: resumes.id });

  if (claimed.length === 0) {
    log("info", "resume not claimable in current status, skipping", { resumeId: job.resumeId });

    return "skipped";
  }

  if (cached[0]?.parsedContent) {
    // SAFETY: cached parsedContent is schema-validated ResumeContent written by a prior completion; cast bridges the column's wide Record type.
    // Same user + same file: career was already classified on the original parse.
    await completeResumes({
      db,
      env,
      items: [{ resumeId: job.resumeId, userId: job.userId }],
      parsedContent: cached[0].parsedContent as ResumeContent,
    });

    return "cached";
  }

  await notifyStatusChange({ resumeId: job.resumeId, status: "processing", env });

  return "parse";
}

/** One replay-safe parse attempt; the Workflow adapter owns retries. */
export function parseResumePdf(
  job: ResumeParseJob,
  env: CloudflareEnv,
): Effect.Effect<ParsedResume | null, ParseFailure> {
  return Effect.gen(function* () {
    const db = getDb(env.HYPERDRIVE);

    const recordFailure = (failure: ParseFailure) =>
      Effect.tryPromise({
        try: () =>
          db
            .update(resumes)
            .set({
              errorMessage: failure.userMessage,
              lastAttemptError: JSON.stringify(toParseErrorJson(failure)),
            })
            .where(and(ne(resumes.status, "completed"), eq(resumes.id, job.resumeId))),
        catch: classifyParseError,
      }).pipe(
        Effect.tapError((error) =>
          Effect.sync(() =>
            log("error", "failed to record parse attempt", {
              resumeId: job.resumeId,
              ...errorFields(error),
            }),
          ),
        ),
        Effect.catch(() => Effect.void),
      );

    const attempt = yield* Effect.tryPromise({
      try: () =>
        db
          .update(resumes)
          .set({ totalAttempts: sql`${resumes.totalAttempts} + 1` })
          .where(and(eq(resumes.id, job.resumeId), eq(resumes.status, "processing")))
          .returning({ id: resumes.id }),
      catch: classifyParseError,
    });

    if (attempt.length === 0) {
      log("info", "resume no longer processing, skipping parse attempt", {
        resumeId: job.resumeId,
      });

      return null;
    }

    return yield* Effect.gen(function* () {
      const r2Binding = getR2Binding(env);

      if (!r2Binding) return yield* new R2BindingMissing({ message: "R2 binding not available" });

      const pdfBuffer = yield* Effect.tryPromise({
        try: () => R2.getAsArrayBuffer(r2Binding, job.r2Key),
        catch: r2Failure,
      });

      if (!pdfBuffer)
        // No key in the message: it ends in the uploader's file name, and the message is logged.
        return yield* new R2ObjectMissing({ message: "Failed to fetch PDF from R2" });
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
export async function readLastParseFailure(
  job: ResumeParseJob,
  env: CloudflareEnv,
): Promise<ParseErrorJson | null> {
  const [row] = await getDb(env.HYPERDRIVE)
    .select({ lastAttemptError: resumes.lastAttemptError })
    .from(resumes)
    .where(eq(resumes.id, job.resumeId))
    .limit(1);

  return readStoredParseError(row?.lastAttemptError ?? null);
}

/** Marks the row completed and fans the result out to identical uploads waiting on it. */
export async function completeParsedResume(
  job: ResumeParseJob,
  parsed: ParsedResume,
  env: CloudflareEnv,
): Promise<void> {
  const db = getDb(env.HYPERDRIVE);
  // `?? null`: results persisted by a workflow step from before `career` existed.
  const career = parsed.career ?? null;

  await completeResumes({
    db,
    env,
    items: [{ resumeId: job.resumeId, userId: job.userId }],
    parsedContent: parsed.parsedContent,
    career,
  });

  const waitingResumes = await db
    .select({ id: resumes.id, userId: resumes.userId })
    .from(resumes)
    .where(
      and(
        eq(resumes.userId, job.userId),
        eq(resumes.fileHash, job.fileHash),
        eq(resumes.status, "waiting_for_cache"),
      ),
    );

  if (waitingResumes.length > 0) {
    await completeResumes({
      db,
      env,
      items: waitingResumes.map((w) => ({ resumeId: w.id, userId: w.userId })),
      parsedContent: parsed.parsedContent,
      career,
      fanOut: true,
    });
  }
}

/** Terminal failure: every retry is spent or the error is permanent. */
export async function markResumeParseFailed(
  job: ResumeParseJob,
  storedError: ParseErrorJson,
  env: CloudflareEnv,
): Promise<void> {
  const db = getDb(env.HYPERDRIVE);

  const failed = await db
    .update(resumes)
    .set({
      status: "failed",
      errorMessage: sql`COALESCE(${resumes.errorMessage}, ${GENERIC_ERROR_MESSAGE})`,
      lastAttemptError: JSON.stringify(storedError),
      updatedAt: new Date().toISOString(),
    })
    .where(and(ne(resumes.status, "completed"), eq(resumes.id, job.resumeId)))
    .returning({ totalAttempts: resumes.totalAttempts, errorMessage: resumes.errorMessage });

  // Row gone (account deletion cascade) or completed elsewhere: nothing to report.
  if (failed.length === 0) return;

  await ignoreAndLog(
    () =>
      notifyStatusChange({
        resumeId: job.resumeId,
        status: "failed",
        error: storedError.message,
        env,
      }),
    "failed to notify parse status",
  );

  // Identical uploads waiting on this parse would otherwise sit until their
  // waiting_for_cache timer and report a misleading timeout.
  const waitingFailed = await db
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
    .returning({ id: resumes.id });

  await Promise.all(
    waitingFailed.map((row) =>
      ignoreAndLog(
        () =>
          notifyStatusChange({
            resumeId: row.id,
            status: "failed",
            error: storedError.message,
            env,
          }),
        "failed to notify waiting status",
      ),
    ),
  );

  // SAFETY: env is CloudflareEnv with optional AlertEnv fields; cast narrows to AlertEnv for alert channel access, fallback via getAlertChannel.
  const alertEnv = env as AlertEnv;
  await ignoreAndLog(
    () =>
      sendAlert(
        {
          resumeId: job.resumeId,
          userId: job.userId,
          failureReason: storedError.message,
          errorType: storedError.type,
          totalAttempts: failed[0].totalAttempts ?? 0,
          timestamp: new Date().toISOString(),
        },
        getAlertChannel(alertEnv.ALERT_CHANNEL),
        alertEnv,
      ),
    "failed to send parse alert",
  );
}

/** Persists the waiting_for_cache timeout if no identical parse completed the row in time. */
export async function expireWaitingForCache(
  resumeId: string,
  env: CloudflareEnv,
): Promise<boolean> {
  const db = getDb(env.HYPERDRIVE);

  const expired = await db
    .update(resumes)
    .set(buildWaitingForCacheTimeoutUpdate())
    .where(and(eq(resumes.id, resumeId), eq(resumes.status, "waiting_for_cache")))
    .returning({ id: resumes.id });

  if (expired.length === 0 && !(await expiredByThisTimer(db, resumeId))) return false;

  // Also reached by a retry whose first attempt committed the UPDATE: notifying again is harmless.
  await notifyStatusChange({
    resumeId,
    status: "failed",
    error: buildWaitingForCacheTimeoutUpdate().errorMessage,
    env,
  });

  return true;
}

/**
 * Workflows retries this step until it returns, so an attempt that committed the UPDATE and
 * was lost before returning meets a row that is already failed. Answering "resolved" there would
 * skip the failure email for good. Only the timeout message with no stored parse error identifies
 * the row as ours: a row failed by the parse it waited on was already mailed by that run.
 */
async function expiredByThisTimer(db: Database, resumeId: string): Promise<boolean> {
  const [row] = await db
    .select({
      status: resumes.status,
      errorMessage: resumes.errorMessage,
      lastAttemptError: resumes.lastAttemptError,
    })
    .from(resumes)
    .where(eq(resumes.id, resumeId))
    .limit(1);

  const timeout = buildWaitingForCacheTimeoutUpdate();

  // The timer never writes lastAttemptError; the parse failure fan-out always does, and it can
  // copy a stale timeout message onto its waiting rows.
  return (
    row?.status === timeout.status &&
    row.errorMessage === timeout.errorMessage &&
    row.lastAttemptError === null
  );
}
