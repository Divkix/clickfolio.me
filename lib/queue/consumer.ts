import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { resumes, siteData } from "../db/schema";
import { getSessionDb } from "../db/session";
import { parseResumeWithGemini } from "../gemini";
import { getR2Binding, R2 } from "../r2";
import type { CacheInvalidationMessage, QueueMessage, ResumeParseMessage } from "./types";

/**
 * Get cache tag for a resume handle (matches lib/utils/cache.ts pattern)
 */
function getResumeCacheTag(handle: string): string {
  return `resume:${handle}`;
}

/**
 * Upsert site_data with UNIQUE constraint handling
 */
async function upsertSiteData(
  db: Awaited<ReturnType<typeof getSessionDb>>["db"],
  userId: string,
  resumeId: string,
  content: string,
  now: string,
): Promise<void> {
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
  const { db, captureBookmark } = await getSessionDb(env.DB);
  const r2Binding = getR2Binding(env);

  if (!r2Binding) {
    throw new Error("R2 binding not available");
  }

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
      })
      .where(eq(resumes.id, message.resumeId));

    await upsertSiteData(
      db,
      message.userId,
      message.resumeId,
      cached[0].parsedContent as string,
      now,
    );

    await captureBookmark();
    return;
  }

  // Update status to processing
  await db.update(resumes).set({ status: "processing" }).where(eq(resumes.id, message.resumeId));

  // Fetch PDF from R2
  const pdfBuffer = await R2.getAsUint8Array(r2Binding, message.r2Key);
  if (!pdfBuffer) {
    throw new Error(`Failed to fetch PDF from R2: ${message.r2Key}`);
  }

  // Parse with Gemini
  const parseResult = await parseResumeWithGemini(pdfBuffer, env);

  if (!parseResult.success) {
    await db
      .update(resumes)
      .set({
        status: "failed",
        errorMessage: parseResult.error || "Parsing failed",
      })
      .where(eq(resumes.id, message.resumeId));
    await captureBookmark();
    throw new Error(parseResult.error || "Parsing failed");
  }

  // Validate JSON
  let parsedContent = parseResult.parsedContent;
  try {
    const parsedJson = JSON.parse(parsedContent);
    parsedContent = JSON.stringify(parsedJson);
  } catch {
    await db
      .update(resumes)
      .set({
        status: "failed",
        errorMessage: "Invalid JSON response from AI",
      })
      .where(eq(resumes.id, message.resumeId));
    await captureBookmark();
    throw new Error("Invalid JSON response from AI");
  }

  const now = new Date().toISOString();

  // Update primary resume
  await db
    .update(resumes)
    .set({
      status: "completed",
      parsedAt: now,
      parsedContent,
    })
    .where(eq(resumes.id, message.resumeId));

  await upsertSiteData(db, message.userId, message.resumeId, parsedContent, now);

  // FIX: Notify ALL resumes waiting for this fileHash
  const waitingResumes = await db
    .select({ id: resumes.id, userId: resumes.userId })
    .from(resumes)
    .where(and(eq(resumes.fileHash, message.fileHash), eq(resumes.status, "waiting_for_cache")));

  for (const waiting of waitingResumes) {
    await db
      .update(resumes)
      .set({
        status: "completed",
        parsedAt: now,
        parsedContent,
      })
      .where(eq(resumes.id, waiting.id));

    await upsertSiteData(db, waiting.userId as string, waiting.id as string, parsedContent, now);
  }

  await captureBookmark();
}

/**
 * Handle cache invalidation from queue
 */
async function handleCacheInvalidation(message: CacheInvalidationMessage): Promise<void> {
  for (const handle of message.handles) {
    revalidateTag(getResumeCacheTag(handle), "max");
  }

  for (const path of message.paths) {
    revalidatePath(path);
  }
}

/**
 * Main queue consumer handler
 * Export this from the worker entry point
 */
export async function handleQueueMessage(message: QueueMessage, env: CloudflareEnv): Promise<void> {
  switch (message.type) {
    case "parse":
      await handleResumeParse(message, env);
      break;
    case "invalidate":
      await handleCacheInvalidation(message);
      break;
    default: {
      const _exhaustive: never = message;
      throw new Error(`Unknown message type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
