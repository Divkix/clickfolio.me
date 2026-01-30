import { and, eq, isNotNull } from "drizzle-orm";
import { resumes, siteData } from "../db/schema";
import { getSessionDbForWebhook } from "../db/session";
import { parseResumeWithGemini } from "../gemini";
import { getR2Binding, R2 } from "../r2";
import type { ResumeContent } from "../types/database";
import { extractPreviewFields } from "../utils/preview-fields";
import { classifyQueueError } from "./errors";
import { notifyStatusChange, notifyStatusChangeBatch } from "./notify-status";
import type { QueueMessage, ResumeParseMessage } from "./types";

/**
 * Upsert site_data with UNIQUE constraint handling
 * Extracts preview fields from content for denormalized columns
 */
async function upsertSiteData(
  db: ReturnType<typeof getSessionDbForWebhook>["db"],
  userId: string,
  resumeId: string,
  content: string,
  now: string,
): Promise<void> {
  // Parse content to extract preview fields
  let parsedContent: ResumeContent | null = null;
  try {
    parsedContent = JSON.parse(content) as ResumeContent;
  } catch {
    // If parsing fails, continue without preview fields
    console.warn(`Failed to parse content for preview fields extraction, resumeId: ${resumeId}`);
  }

  const previewFields = extractPreviewFields(parsedContent);

  const existingSiteData = await db
    .select({ id: siteData.id })
    .from(siteData)
    .where(eq(siteData.userId, userId))
    .limit(1);

  if (existingSiteData[0]) {
    await db
      .update(siteData)
      .set({
        resumeId,
        content,
        ...previewFields,
        lastPublishedAt: now,
        updatedAt: now,
      })
      .where(eq(siteData.userId, userId));
  } else {
    try {
      await db.insert(siteData).values({
        id: crypto.randomUUID(),
        userId,
        resumeId,
        content,
        ...previewFields,
        lastPublishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        await db
          .update(siteData)
          .set({
            resumeId,
            content,
            ...previewFields,
            lastPublishedAt: now,
            updatedAt: now,
          })
          .where(eq(siteData.userId, userId));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Handle resume parsing from queue
 */
async function handleResumeParse(message: ResumeParseMessage, env: CloudflareEnv): Promise<void> {
  const { db } = getSessionDbForWebhook(env.DB);
  const r2Binding = getR2Binding(env);

  if (!r2Binding) {
    throw new Error("R2 binding not available");
  }

  // Check for staged content from previous attempt (idempotency)
  const currentResume = await db
    .select({
      status: resumes.status,
      parsedContent: resumes.parsedContent,
      parsedContentStaged: resumes.parsedContentStaged,
      totalAttempts: resumes.totalAttempts,
    })
    .from(resumes)
    .where(eq(resumes.id, message.resumeId))
    .limit(1);

  // If already completed with parsed content, skip (full idempotency)
  if (currentResume[0]?.status === "completed" && currentResume[0]?.parsedContent) {
    console.log(`Resume ${message.resumeId} already completed, skipping`);
    return;
  }

  // If staged content exists, use it instead of re-parsing
  if (currentResume[0]?.parsedContentStaged) {
    console.log(`Using staged content for resume ${message.resumeId}`);
    const now = new Date().toISOString();

    // Commit staged content to final
    await db
      .update(resumes)
      .set({
        status: "completed",
        parsedAt: now,
        parsedContent: currentResume[0].parsedContentStaged,
        parsedContentStaged: null, // Clear staging
        lastAttemptError: null, // Clear error on success
      })
      .where(eq(resumes.id, message.resumeId));

    await upsertSiteData(
      db,
      message.userId,
      message.resumeId,
      currentResume[0].parsedContentStaged as string,
      now,
    );

    await notifyStatusChange({ resumeId: message.resumeId, status: "completed", env });
    return;
  }

  // Increment total attempts
  await db
    .update(resumes)
    .set({ totalAttempts: (currentResume[0]?.totalAttempts || 0) + 1 })
    .where(eq(resumes.id, message.resumeId));

  // Check for cached result with same fileHash (deduplication)
  const cached = await db
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
    .limit(1);

  if (cached[0]?.parsedContent) {
    // Use cached result
    const now = new Date().toISOString();
    await db
      .update(resumes)
      .set({
        status: "completed",
        parsedAt: now,
        parsedContent: cached[0].parsedContent,
        lastAttemptError: null,
      })
      .where(eq(resumes.id, message.resumeId));

    await upsertSiteData(
      db,
      message.userId,
      message.resumeId,
      cached[0].parsedContent as string,
      now,
    );

    await notifyStatusChange({ resumeId: message.resumeId, status: "completed", env });
    return;
  }

  // Update status to processing
  await db.update(resumes).set({ status: "processing" }).where(eq(resumes.id, message.resumeId));
  await notifyStatusChange({ resumeId: message.resumeId, status: "processing", env });

  // Fetch PDF from R2
  const pdfBuffer = await R2.getAsUint8Array(r2Binding, message.r2Key);
  if (!pdfBuffer) {
    const error = new Error(`Failed to fetch PDF from R2: ${message.r2Key}`);
    await db
      .update(resumes)
      .set({ lastAttemptError: error.message })
      .where(eq(resumes.id, message.resumeId));
    throw error;
  }

  // Parse with Gemini
  const parseResult = await parseResumeWithGemini(pdfBuffer, env);

  if (!parseResult.success) {
    const errorMessage = parseResult.error || "Parsing failed";
    await db
      .update(resumes)
      .set({
        status: "failed",
        errorMessage,
        lastAttemptError: errorMessage,
      })
      .where(eq(resumes.id, message.resumeId));
    await notifyStatusChange({
      resumeId: message.resumeId,
      status: "failed",
      error: errorMessage,
      env,
    });
    throw new Error(errorMessage);
  }

  // Validate JSON
  let parsedContent = parseResult.parsedContent;
  try {
    const parsedJson = JSON.parse(parsedContent);
    parsedContent = JSON.stringify(parsedJson);
  } catch {
    const errorMessage = "Invalid JSON response from AI";
    await db
      .update(resumes)
      .set({
        status: "failed",
        errorMessage,
        lastAttemptError: errorMessage,
      })
      .where(eq(resumes.id, message.resumeId));
    await notifyStatusChange({
      resumeId: message.resumeId,
      status: "failed",
      error: errorMessage,
      env,
    });
    throw new Error(errorMessage);
  }

  const now = new Date().toISOString();

  // Stage content first (allows recovery if next steps fail)
  await db
    .update(resumes)
    .set({ parsedContentStaged: parsedContent })
    .where(eq(resumes.id, message.resumeId));

  // Then update to completed and copy to final
  await db
    .update(resumes)
    .set({
      status: "completed",
      parsedAt: now,
      parsedContent,
      parsedContentStaged: null, // Clear staging
      lastAttemptError: null, // Clear error on success
    })
    .where(eq(resumes.id, message.resumeId));

  await upsertSiteData(db, message.userId, message.resumeId, parsedContent, now);
  await notifyStatusChange({ resumeId: message.resumeId, status: "completed", env });

  // Notify ALL resumes waiting for this fileHash
  const waitingResumes = await db
    .select({ id: resumes.id, userId: resumes.userId })
    .from(resumes)
    .where(and(eq(resumes.fileHash, message.fileHash), eq(resumes.status, "waiting_for_cache")));

  // Batch update all waiting resumes with same fileHash to completed
  if (waitingResumes.length > 0) {
    await db
      .update(resumes)
      .set({
        status: "completed",
        parsedAt: now,
        parsedContent,
        parsedContentStaged: null,
      })
      .where(and(eq(resumes.fileHash, message.fileHash), eq(resumes.status, "waiting_for_cache")));
  }

  // Still need individual site data upserts for waiting resumes
  for (const waiting of waitingResumes) {
    await upsertSiteData(db, waiting.userId as string, waiting.id as string, parsedContent, now);
  }

  // Notify waiting resumes via WebSocket
  if (waitingResumes.length > 0) {
    await notifyStatusChangeBatch(
      waitingResumes.map((r) => r.id as string),
      "completed",
      env,
    );
  }
}

/**
 * Main queue consumer handler
 * Export this from the worker entry point
 */
export async function handleQueueMessage(message: QueueMessage, env: CloudflareEnv): Promise<void> {
  const { db } = getSessionDbForWebhook(env.DB);

  try {
    // Currently only supporting parse messages
    // Add additional handlers here when new message types are added
    await handleResumeParse(message, env);
  } catch (error) {
    // Record the error for debugging
    const classifiedError = classifyQueueError(error);
    await db
      .update(resumes)
      .set({ lastAttemptError: classifiedError.message })
      .where(eq(resumes.id, message.resumeId));

    // Re-throw so the worker can decide whether to retry
    throw error;
  }
}
