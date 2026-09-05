import { and, eq, isNotNull, ne } from "drizzle-orm";
import type { UserRole } from "../db/schema";
import { resumes } from "../db/schema";
import { getDb } from "../db";
import { getR2Binding, R2 } from "../r2";
import { completeResumes } from "../resume/completion";
import { resumeContentSchema } from "../schemas/resume";
import type { ResumeContent } from "../types/database";
import { getAlertChannel, sendAlert, type AlertEnv } from "./alert";
import { classifyQueueError, isRetryableError, type QueueErrorInput } from "./errors";
import { notifyStatusChange } from "./notify-status";
import type { QueueMessage, ResumeParseMessage } from "./types";
import { log } from "../utils/log";

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

async function handleResumeParse(message: ResumeParseMessage, env: CloudflareEnv): Promise<void> {
  const db = getDb(env.HYPERDRIVE);
  const r2Binding = getR2Binding(env);

  if (!r2Binding) {
    throw new Error("R2 binding not available");
  }

  const [currentResume, cached] = await Promise.all([
    db
      .select({
        status: resumes.status,
        parsedContent: resumes.parsedContent,
        totalAttempts: resumes.totalAttempts,
      })
      .from(resumes)
      .where(eq(resumes.id, message.resumeId))
      .limit(1),

    db
      .select({ id: resumes.id, parsedContent: resumes.parsedContent })
      .from(resumes)
      .where(
        and(
          eq(resumes.userId, message.userId),
          eq(resumes.fileHash, message.fileHash),
          eq(resumes.status, "completed"),
          isNotNull(resumes.parsedContent),
        ),
      )
      .limit(1),
  ]);

  if (!currentResume[0]) {
    log("info", "resume not found, skipping parse", { resumeId: message.resumeId });
    return;
  }

  if (currentResume[0]?.status === "completed" && currentResume[0]?.parsedContent) {
    log("info", "resume already completed, skipping", { resumeId: message.resumeId });
    return;
  }

  const nextAttemptCount = (currentResume[0]?.totalAttempts || 0) + 1;

  if (cached[0]?.parsedContent) {
    // SAFETY: cached parsedContent is schema-validated ResumeContent written by a prior completion; cast bridges the column's wide Record type.
    const cachedContent = cached[0].parsedContent as ResumeContent;
    await completeResumes({
      db,
      env,
      items: [{ resumeId: message.resumeId, userId: message.userId }],
      parsedContent: cachedContent,
      professionalLevel: cachedContent.professional_level ?? undefined,
      totalAttempts: nextAttemptCount,
    });
    return;
  }

  await db
    .update(resumes)
    .set({ status: "processing", totalAttempts: nextAttemptCount })
    .where(eq(resumes.id, message.resumeId));
  await notifyStatusChange({
    resumeId: message.resumeId,
    status: "processing",
    env,
  });

  const pdfBuffer = await R2.getAsArrayBuffer(r2Binding, message.r2Key);
  if (!pdfBuffer) {
    const error = new Error(`Failed to fetch PDF from R2: ${message.r2Key}`);
    const classifiedError = classifyQueueError(error);
    await db
      .update(resumes)
      .set({ lastAttemptError: JSON.stringify(classifiedError.toJSON()) })
      .where(eq(resumes.id, message.resumeId));
    throw error;
  }

  const { parseResumeWithAi } = await import("../ai");

  const parseResult = await parseResumeWithAi(pdfBuffer, env);

  if (!parseResult.success) {
    const rawError = parseResult.error || "Parsing failed";
    const userError = getUserFriendlyError(rawError);
    const classifiedError = classifyQueueError(new Error(rawError));
    await db
      .update(resumes)
      .set({
        errorMessage: userError,
        lastAttemptError: JSON.stringify(classifiedError.toJSON()),
      })
      .where(eq(resumes.id, message.resumeId));
    throw new Error(rawError);
  }

  let parsedContent: ResumeContent;
  try {
    parsedContent = resumeContentSchema.parse(JSON.parse(parseResult.parsedContent));
  } catch {
    throw new Error(`Invalid JSON response from AI parser for resume ${message.resumeId}`);
  }
  // SAFETY: AI returns professionalLevel as validated string from resumeContentSchema; UserRole cast narrows to enum with undefined fallback if missing.
  const professionalLevel = parseResult.professionalLevel as UserRole | undefined;

  await completeResumes({
    db,
    env,
    items: [{ resumeId: message.resumeId, userId: message.userId }],
    parsedContent,
    professionalLevel,
  });

  const waitingResumes = await db
    .select({ id: resumes.id, userId: resumes.userId })
    .from(resumes)
    .where(and(eq(resumes.fileHash, message.fileHash), eq(resumes.status, "waiting_for_cache")));

  if (waitingResumes.length > 0) {
    await completeResumes({
      db,
      env,
      items: waitingResumes.map((w) => ({ resumeId: w.id, userId: w.userId })),
      parsedContent,
      professionalLevel,
      fanOut: true,
    });
  }
}

export async function handleQueueMessage(message: QueueMessage, env: CloudflareEnv): Promise<void> {
  const db = getDb(env.HYPERDRIVE);

  try {
    await handleResumeParse(message, env);
  } catch (error) {
    // SAFETY: catch error is unknown; QueueErrorInput covers Error|string|object|null for classification.
    const isRetryable = isRetryableError(error as QueueErrorInput);

    if (!isRetryable) {
      // SAFETY: error is unknown from catch; cast to QueueErrorInput for classification (covers Error|string|object).
      const classifiedError = classifyQueueError(error as QueueErrorInput);
      await db
        .update(resumes)
        .set({
          status: "failed",
          lastAttemptError: JSON.stringify(classifiedError.toJSON()),
        })
        .where(and(ne(resumes.status, "completed"), eq(resumes.id, message.resumeId)));
      await notifyStatusChange({
        resumeId: message.resumeId,
        status: "failed",
        error: classifiedError.message,
        env,
      });

      // SAFETY: env is CloudflareEnv with optional AlertEnv fields; cast narrows to AlertEnv for alert channel access, fallback via getAlertChannel.
      const alertEnv = env as AlertEnv;
      await sendAlert(
        {
          resumeId: message.resumeId,
          userId: message.userId,
          failureReason: classifiedError.message,
          errorType: classifiedError.type,
          totalAttempts: message.attempt,
          timestamp: new Date().toISOString(),
        },
        getAlertChannel(alertEnv.ALERT_CHANNEL),
        alertEnv,
      );
    } else {
      // SAFETY: error is unknown from catch; QueueErrorInput covers classification cases.
      const classifiedError = classifyQueueError(error as QueueErrorInput);
      await db
        .update(resumes)
        .set({
          lastAttemptError: JSON.stringify(classifiedError.toJSON()),
        })
        .where(eq(resumes.id, message.resumeId));
    }

    throw error;
  }
}
