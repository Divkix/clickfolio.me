import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { UserRole } from "../db/schema";
import { resumes } from "../db/schema";
import { getDb } from "../db";
import { getR2Binding, R2 } from "../r2";
import { buildWaitingForCacheTimeoutUpdate } from "../resume/lifecycle";
import { completeResumes } from "../resume/completion";
import { resumeContentSchema } from "../schemas/resume";
import type { ResumeContent } from "../types/database";
import { getAlertChannel, sendAlert, type AlertEnv } from "./alert";
import { classifyParseError, type ParseErrorInput } from "./errors";
import { notifyStatusChange } from "./notify-status";
import { log } from "../utils/log";

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
  professionalLevel: UserRole | null;
};

function getUserFriendlyError(rawError: string): string {
  const lower = rawError.toLowerCase();

  if (/password.protected|encrypted/.test(lower)) {
    return "Your PDF is password-protected. Please upload an unprotected version.";
  }

  if (/invalid.*pdf|corrupt/.test(lower)) {
    return "Your PDF couldn't be read. Please upload a valid PDF file.";
  }

  if (/scanned.*pdf.*clearer|scanned.*pdf.*export|clearer.*photo/.test(lower)) {
    return "No text could be extracted from your scanned PDF. Try a clearer photo or export as text PDF.";
  }

  if (/extracted.*text.*is.*empty/.test(lower)) {
    return "No text could be extracted from your PDF. It may be a scanned image.";
  }

  if (/pdf.*has.*\d+.*pages/.test(lower)) {
    return "Your PDF is too long. Please upload a resume under 50 pages.";
  }

  if (/schema.*validation/.test(lower)) {
    return "We couldn't parse your resume format. Please try again.";
  }

  if (/timeout|timed.*out/.test(lower)) {
    return "Processing timed out. Please try again.";
  }

  return "Something went wrong while parsing your resume. Please try again.";
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
    const cachedContent = cached[0].parsedContent as ResumeContent;
    await completeResumes({
      db,
      env,
      items: [{ resumeId: job.resumeId, userId: job.userId }],
      parsedContent: cachedContent,
      professionalLevel: cachedContent.professional_level ?? undefined,
    });

    return "cached";
  }

  await notifyStatusChange({ resumeId: job.resumeId, status: "processing", env });

  return "parse";
}

/**
 * One parse attempt. Records the attempt on the row, then throws a classified
 * ParseError on failure so the workflow can decide whether to retry.
 * Returns null when the row left `processing` (deleted or completed elsewhere).
 */
export async function parseResumePdf(
  job: ResumeParseJob,
  env: CloudflareEnv,
): Promise<ParsedResume | null> {
  const db = getDb(env.HYPERDRIVE);

  const attempt = await db
    .update(resumes)
    .set({ totalAttempts: sql`${resumes.totalAttempts} + 1` })
    .where(and(eq(resumes.id, job.resumeId), eq(resumes.status, "processing")))
    .returning({ id: resumes.id });

  if (attempt.length === 0) {
    log("info", "resume no longer processing, skipping parse attempt", {
      resumeId: job.resumeId,
    });

    return null;
  }

  try {
    const r2Binding = getR2Binding(env);

    if (!r2Binding) {
      throw new Error("R2 binding not available");
    }

    const pdfBuffer = await R2.getAsArrayBuffer(r2Binding, job.r2Key);

    if (!pdfBuffer) {
      throw new Error(`Failed to fetch PDF from R2: ${job.r2Key}`);
    }

    const { parseResumeWithAi } = await import("../ai");
    const parseResult = await parseResumeWithAi(pdfBuffer, env);

    if (!parseResult.success) {
      const rawError = parseResult.error || "AI parser returned no result";
      await db
        .update(resumes)
        .set({ errorMessage: getUserFriendlyError(rawError) })
        .where(eq(resumes.id, job.resumeId));
      throw new Error(rawError);
    }

    let parsedContent: ResumeContent;

    try {
      parsedContent = resumeContentSchema.parse(JSON.parse(parseResult.parsedContent));
    } catch {
      throw new Error(`Invalid JSON response from AI parser for resume ${job.resumeId}`);
    }

    return {
      parsedContent,
      // SAFETY: AI returns professionalLevel as validated string from resumeContentSchema; UserRole cast narrows to enum with null fallback if missing.
      professionalLevel: (parseResult.professionalLevel as UserRole | undefined) ?? null,
    };
  } catch (error) {
    // SAFETY: catch error is unknown; ParseErrorInput covers Error|string|object for classification.
    const classified = classifyParseError(error as ParseErrorInput);
    await db
      .update(resumes)
      .set({ lastAttemptError: JSON.stringify(classified.toJSON()) })
      .where(and(ne(resumes.status, "completed"), eq(resumes.id, job.resumeId)));
    throw classified;
  }
}

/** Marks the row completed and fans the result out to identical uploads waiting on it. */
export async function completeParsedResume(
  job: ResumeParseJob,
  parsed: ParsedResume,
  env: CloudflareEnv,
): Promise<void> {
  const db = getDb(env.HYPERDRIVE);
  const professionalLevel = parsed.professionalLevel ?? undefined;

  await completeResumes({
    db,
    env,
    items: [{ resumeId: job.resumeId, userId: job.userId }],
    parsedContent: parsed.parsedContent,
    professionalLevel,
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
      professionalLevel,
      fanOut: true,
    });
  }
}

/** Terminal failure: every retry is spent or the error is permanent. */
export async function markResumeParseFailed(
  job: ResumeParseJob,
  errorMessage: string,
  env: CloudflareEnv,
): Promise<void> {
  const db = getDb(env.HYPERDRIVE);
  const classified = classifyParseError(errorMessage);

  const failed = await db
    .update(resumes)
    .set({
      status: "failed",
      errorMessage: sql`COALESCE(${resumes.errorMessage}, ${getUserFriendlyError(errorMessage)})`,
      lastAttemptError: JSON.stringify(classified.toJSON()),
      updatedAt: new Date().toISOString(),
    })
    .where(and(ne(resumes.status, "completed"), eq(resumes.id, job.resumeId)))
    .returning({ totalAttempts: resumes.totalAttempts });

  // Row gone (account deletion cascade) or completed elsewhere: nothing to report.
  if (failed.length === 0) return;

  await notifyStatusChange({
    resumeId: job.resumeId,
    status: "failed",
    error: classified.message,
    env,
  });

  // SAFETY: env is CloudflareEnv with optional AlertEnv fields; cast narrows to AlertEnv for alert channel access, fallback via getAlertChannel.
  const alertEnv = env as AlertEnv;
  await sendAlert(
    {
      resumeId: job.resumeId,
      userId: job.userId,
      failureReason: classified.message,
      errorType: classified.type,
      totalAttempts: failed[0].totalAttempts ?? 0,
      timestamp: new Date().toISOString(),
    },
    getAlertChannel(alertEnv.ALERT_CHANNEL),
    alertEnv,
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

  if (expired.length === 0) return false;

  await notifyStatusChange({
    resumeId,
    status: "failed",
    error: buildWaitingForCacheTimeoutUpdate().errorMessage,
    env,
  });

  return true;
}
