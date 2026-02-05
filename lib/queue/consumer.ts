import { and, eq, isNotNull } from "drizzle-orm";
import { resumes, siteData } from "../db/schema";
import { getSessionDbForWebhook } from "../db/session";
import { getR2Binding, R2 } from "../r2";
import type { ResumeContent } from "../types/database";
import { extractPreviewFields } from "../utils/preview-fields";
import { classifyQueueError } from "./errors";
import { notifyStatusChange, notifyStatusChangeBatch } from "./notify-status";
import type { QueueMessage, ResumeParseMessage } from "./types";

/**
 * Build the siteData upsert query (not executed).
 * Returned so callers can include it in a db.batch() call.
 */
function buildSiteDataUpsert(
  db: ReturnType<typeof getSessionDbForWebhook>["db"],
  userId: string,
  resumeId: string,
  content: string,
  now: string,
) {
  // Parse content to extract preview fields
  let parsedContent: ResumeContent | null = null;
  try {
    parsedContent = JSON.parse(content) as ResumeContent;
  } catch {
    console.warn(`Failed to parse content for preview fields extraction, resumeId: ${resumeId}`);
  }

  const previewFields = extractPreviewFields(parsedContent);

  return db
    .insert(siteData)
    .values({
      id: crypto.randomUUID(),
      userId,
      resumeId,
      content,
      ...previewFields,
      lastPublishedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteData.userId,
      set: {
        resumeId,
        content,
        ...previewFields,
        lastPublishedAt: now,
        updatedAt: now,
      },
    });
}

/**
 * Execute siteData upsert standalone (for paths that cannot use batch).
 */
async function upsertSiteData(
  db: ReturnType<typeof getSessionDbForWebhook>["db"],
  userId: string,
  resumeId: string,
  content: string,
  now: string,
): Promise<void> {
  await buildSiteDataUpsert(db, userId, resumeId, content, now);
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
    const stagedContent = currentResume[0].parsedContentStaged as string;

    // M7: Batch resume completion + siteData upsert atomically
    await db.batch([
      db
        .update(resumes)
        .set({
          status: "completed",
          parsedAt: now,
          parsedContent: stagedContent,
          parsedContentStaged: null,
          lastAttemptError: null,
        })
        .where(eq(resumes.id, message.resumeId)),
      buildSiteDataUpsert(db, message.userId, message.resumeId, stagedContent, now),
    ]);

    await notifyStatusChange({ resumeId: message.resumeId, status: "completed", env });
    return;
  }

  // M7: Fold totalAttempts increment into later updates to eliminate standalone UPDATE.
  const nextAttemptCount = (currentResume[0]?.totalAttempts || 0) + 1;

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
    // Use cached result — M7: include totalAttempts increment in same UPDATE
    const now = new Date().toISOString();
    const cachedContent = cached[0].parsedContent as string;

    // M7: Batch resume completion + siteData upsert atomically
    await db.batch([
      db
        .update(resumes)
        .set({
          status: "completed",
          parsedAt: now,
          parsedContent: cachedContent,
          lastAttemptError: null,
          totalAttempts: nextAttemptCount,
        })
        .where(eq(resumes.id, message.resumeId)),
      buildSiteDataUpsert(db, message.userId, message.resumeId, cachedContent, now),
    ]);

    await notifyStatusChange({ resumeId: message.resumeId, status: "completed", env });
    return;
  }

  // Update status to processing — M7: include totalAttempts increment in same UPDATE
  await db
    .update(resumes)
    .set({ status: "processing", totalAttempts: nextAttemptCount })
    .where(eq(resumes.id, message.resumeId));
  await notifyStatusChange({ resumeId: message.resumeId, status: "processing", env });

  // M9: Fetch PDF from R2 as ArrayBuffer directly — no intermediate Uint8Array copy
  const pdfBuffer = await R2.getAsArrayBuffer(r2Binding, message.r2Key);
  if (!pdfBuffer) {
    const error = new Error(`Failed to fetch PDF from R2: ${message.r2Key}`);
    await db
      .update(resumes)
      .set({ lastAttemptError: error.message })
      .where(eq(resumes.id, message.resumeId));
    throw error;
  }

  // Lazy-load AI modules only when actually needed for parsing.
  // Normal HTTP requests (page views, API calls) never evaluate unpdf/Vercel AI SDK.
  const { parseResumeWithAi } = await import("../ai");

  // M9: Pass ArrayBuffer directly — parseResumeWithAi now accepts ArrayBuffer
  const parseResult = await parseResumeWithAi(pdfBuffer, env);

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

  // parsedContent is produced by JSON.stringify() in parseResumeWithAi — guaranteed valid JSON
  const parsedContent = parseResult.parsedContent;

  const now = new Date().toISOString();

  // M10: Single atomic UPDATE replaces the two-step stage-then-complete pattern.
  // The staging column was a crash-recovery mechanism between two UPDATEs.
  // With one atomic UPDATE, there is no crash window to recover from.
  await db
    .update(resumes)
    .set({
      status: "completed",
      parsedAt: now,
      parsedContent,
      parsedContentStaged: null,
      lastAttemptError: null,
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
