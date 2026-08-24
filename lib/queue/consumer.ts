import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { buildSiteDataUpsert } from "../data/site-data-upsert";
import type { UserRole } from "../db/schema";
import { resumes, user } from "../db/schema";
import { getDb } from "../db";
import { getR2Binding, R2 } from "../r2";
import { resumeContentSchema } from "../schemas/resume";
import type { ResumeContent } from "../types/database";
import { getAlertChannel, sendAlert, type AlertEnv } from "./alert";
import { classifyQueueError, isRetryableError, type QueueErrorInput } from "./errors";
import { notifyStatusChange, notifyStatusChangeBatch } from "./notify-status";
import type { QueueMessage, ResumeParseMessage } from "./types";
import { log } from "../utils/log";

/**
 * Map raw error messages to user-friendly messages.
 * Raw error is preserved in lastAttemptError for debugging;
 * user-friendly message goes into errorMessage (shown to user).
 */
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
 * Handle resume parsing from queue.
 *
 * Full flow:
 * 1. **Cache lookup** — query for a completed resume with the same `fileHash` to
 *    avoid re-parsing identical PDFs.
 * 2. **Waiting-for-cache fan-out** — after marking the current resume as completed,
 *    find all other resumes waiting on the same `fileHash` and complete them in a
 *    batch update + siteData upsert, then notify all connected clients.
 */
async function handleResumeParse(message: ResumeParseMessage, env: CloudflareEnv): Promise<void> {
  const db = getDb(env.HYPERDRIVE);
  const r2Binding = getR2Binding(env);

  if (!r2Binding) {
    throw new Error("R2 binding not available");
  }

  // Run status check and cache-by-fileHash lookup in parallel.
  // The cache query is cheap (indexed on fileHash+status) and rarely wasted.
  const [currentResume, cached] = await Promise.all([
    // Check the resume row still exists and its current state
    db
      .select({
        status: resumes.status,
        parsedContent: resumes.parsedContent,
        totalAttempts: resumes.totalAttempts,
      })
      .from(resumes)
      .where(eq(resumes.id, message.resumeId))
      .limit(1),

    // Check for cached result with same fileHash (deduplication)
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

  // Resume row no longer exists (e.g. the account was deleted while the message
  // sat in the queue). Skip instead of parsing: the parse would throw an FK
  // violation on the siteData upsert and burn 3 wasted retries before landing in
  // the DLQ with a false DLQ_ALERT.
  if (!currentResume[0]) {
    log("info", "resume not found, skipping parse", { resumeId: message.resumeId });
    return;
  }

  // If already completed with parsed content, skip (full idempotency)
  if (currentResume[0]?.status === "completed" && currentResume[0]?.parsedContent) {
    log("info", "resume already completed, skipping", { resumeId: message.resumeId });
    return;
  }

  // M7: Fold totalAttempts increment into later updates to eliminate standalone UPDATE.
  const nextAttemptCount = (currentResume[0]?.totalAttempts || 0) + 1;

  // Gate publishing on user.handle: if handle IS NULL, site must remain unpublished (lastPublishedAt=null)
  // to avoid creating unreachable published sites. Fetched once here for the
  // cached path (no AI delay, still fresh); re-fetched just before the parsed
  // batch to avoid ~90s stale race after AI parsing.
  const userRow = await db
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, message.userId))
    .limit(1);
  const hasHandle = !!userRow[0]?.handle;
  const now = new Date().toISOString();

  if (cached[0]?.parsedContent) {
    const cachedContent = cached[0].parsedContent;

    // M7: Complete resume + siteData upsert atomically in a single PG transaction.
    await db.transaction(async (tx) => {
      await tx
        .update(resumes)
        .set({
          status: "completed",
          parsedAt: now,
          parsedContent: cachedContent,
          lastAttemptError: null,
          totalAttempts: nextAttemptCount,
        })
        .where(eq(resumes.id, message.resumeId));
      await buildSiteDataUpsert(tx, message.userId, message.resumeId, cachedContent, {
        publish: hasHandle,
      });
    });

    await notifyStatusChange({
      resumeId: message.resumeId,
      status: "completed",
      env,
    });
    return;
  }

  // Update status to processing — M7: include totalAttempts increment in same UPDATE
  await db
    .update(resumes)
    .set({ status: "processing", totalAttempts: nextAttemptCount })
    .where(eq(resumes.id, message.resumeId));
  await notifyStatusChange({
    resumeId: message.resumeId,
    status: "processing",
    env,
  });

  // M9: Fetch PDF from R2 as ArrayBuffer directly — no intermediate Uint8Array copy
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

  // Lazy-load AI modules only when actually needed for parsing.
  // Normal HTTP requests (page views, API calls) never evaluate unpdf/Vercel AI SDK.
  const { parseResumeWithAi } = await import("../ai");

  // M9: Pass ArrayBuffer directly — parseResumeWithAi now accepts ArrayBuffer
  const parseResult = await parseResumeWithAi(pdfBuffer, env);

  if (!parseResult.success) {
    const rawError = parseResult.error || "Parsing failed";
    const userError = getUserFriendlyError(rawError);
    // Issue #83 Fix: Don't set status to "failed" here - let handleQueueMessage decide
    // based on whether the error is retryable. Just store error info for later decision.
    // Issue #91 Fix: Store JSON-serialized classified error for DLQ/retry consumers
    const classifiedError = classifyQueueError(new Error(rawError));
    await db
      .update(resumes)
      .set({
        errorMessage: userError,
        lastAttemptError: JSON.stringify(classifiedError.toJSON()),
      })
      .where(eq(resumes.id, message.resumeId));
    // Note: We intentionally do NOT call notifyStatusChange here with "failed" status
    // because we don't want to show false negative to the user for retryable errors.
    // The worker will decide to retry, and the final "failed" notification will only
    // be sent after retries are exhausted (handled by DLQ consumer).
    // Throw raw error so classifyQueueError pattern matching still works
    throw new Error(rawError);
  }

  // parseResumeWithAi returns JSON.stringify()'d output; PG stores parsedContent/content
  // as JSONB, so decode once here and re-validate against the resume schema at this
  // boundary before the parsed object is threaded through every JSONB write.
  let parsedContent: ResumeContent;
  try {
    parsedContent = resumeContentSchema.parse(JSON.parse(parseResult.parsedContent));
  } catch {
    throw new Error(`Invalid JSON response from AI parser for resume ${message.resumeId}`);
  }
  // SAFETY: AI returns professionalLevel as validated string from resumeContentSchema; UserRole cast narrows to enum with undefined fallback if missing.
  const professionalLevel = parseResult.professionalLevel as UserRole | undefined;

  // Re-fetch hasHandle just before the batch to avoid a stale race: the
  // hasHandle fetched at the top is ~90s stale after the AI parse window.
  // If the user added a handle during parsing we must publish (lastPublishedAt=now);
  // stale false would otherwise destructively unpublish via site-data-upsert
  // (publish=false path now preserves lastPublishedAt, but fresh read is still
  // correct for newly inserted rows).
  const freshRow = await db
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, message.userId))
    .limit(1);
  const freshHasHandle = !!freshRow[0]?.handle;

  // M10: Complete resume + siteData upsert atomically in a single PG transaction.
  // Without this, a crash between the UPDATE and upsert leaves the resume
  // marked "completed" with no siteData, and the idempotency guard above
  // skips it on retry.
  await db.transaction(async (tx) => {
    await tx
      .update(resumes)
      .set({
        status: "completed",
        parsedAt: now,
        parsedContent,
        parsedContentStaged: null,
        lastAttemptError: null,
      })
      .where(eq(resumes.id, message.resumeId));
    await buildSiteDataUpsert(tx, message.userId, message.resumeId, parsedContent, {
      publish: freshHasHandle,
    });
  });

  // Write AI-inferred professional level to user.role separately from the
  // critical resume+siteData batch. If this fails, the resume is still
  // completed and the user can set their role manually via settings.
  // Intentionally overwrites user-set roles on re-upload — the new resume
  // may reflect a different career stage.
  if (professionalLevel) {
    await db
      .update(user)
      .set({ role: professionalLevel, roleSource: "ai", updatedAt: now })
      .where(eq(user.id, message.userId));
  }

  await notifyStatusChange({
    resumeId: message.resumeId,
    status: "completed",
    env,
  });

  // Notify ALL resumes waiting for this fileHash
  const waitingResumes = await db
    .select({ id: resumes.id, userId: resumes.userId })
    .from(resumes)
    .where(and(eq(resumes.fileHash, message.fileHash), eq(resumes.status, "waiting_for_cache")));

  // Apply status update + all siteData upserts atomically in one PG transaction.
  // Without this, a crash between the bulk UPDATE and individual upserts
  // leaves some resumes marked "completed" with no siteData, and the
  // idempotency guard above skips them on retry.
  if (waitingResumes.length > 0) {
    // Gate publishing per waiting user: each waiting resume's site must only be
    // published if THAT user has a handle. A single hasHandle for the primary
    // user would incorrectly publish/unpublish other users' sites.
    const waitingUserIds = [...new Set(waitingResumes.map((w) => w.userId))];
    const waitingHandleRows = waitingUserIds.length
      ? await db
          .select({ id: user.id, handle: user.handle })
          .from(user)
          .where(inArray(user.id, waitingUserIds))
      : [];
    const handleMap = new Map(waitingHandleRows.map((r) => [r.id, !!r.handle]));
    // Scope the bulk UPDATE to the EXACT ids we upsert siteData for (inArray on
    // the SELECTed ids, not fileHash+status): a row that flips to
    // waiting_for_cache between the SELECT and this UPDATE must NOT be completed
    // here — it would be marked "completed" with no siteData upsert. It safely
    // times out in /api/resume/status → failed → manual retry instead.
    await db.transaction(async (tx) => {
      await tx
        .update(resumes)
        .set({
          status: "completed",
          parsedAt: now,
          parsedContent,
          parsedContentStaged: null,
        })
        .where(
          inArray(
            resumes.id,
            waitingResumes.map((w) => w.id),
          ),
        );
      for (const w of waitingResumes) {
        await buildSiteDataUpsert(tx, w.userId, w.id, parsedContent, {
          publish: handleMap.get(w.userId) ?? false,
        });
      }
    });

    // Set AI role for waiting users (same fileHash = same resume content).
    // Separate from batch to avoid Drizzle heterogeneous table type errors.
    // Uses inArray for a single UPDATE instead of N sequential queries.
    if (professionalLevel) {
      await db
        .update(user)
        .set({ role: professionalLevel, roleSource: "ai", updatedAt: now })
        .where(
          inArray(
            user.id,
            waitingResumes.map((w) => w.userId),
          ),
        );
    }
  }

  // Notify waiting resumes via WebSocket
  if (waitingResumes.length > 0) {
    await notifyStatusChangeBatch(
      waitingResumes.map((r) => r.id),
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
  const db = getDb(env.HYPERDRIVE);

  try {
    // Currently only supporting parse messages
    // Add additional handlers here when new message types are added
    await handleResumeParse(message, env);
  } catch (error) {
    // Issue #83 Fix: Only set status to "failed" for non-retryable errors
    // For retryable errors, keep status as "processing" so client doesn't see false negative
    // SAFETY: catch error is unknown; QueueErrorInput covers Error|string|object|null for classification.
    const isRetryable = isRetryableError(error as QueueErrorInput);

    if (!isRetryable) {
      // Non-retryable error - mark as permanently failed.
      // Guard on status != completed (mirrors the DLQ consumer): the resume may
      // have completed via a concurrent path (cache hit / fan-out) between the
      // parse throw and this UPDATE — never clobber a completed row.
      // SAFETY: error is unknown from catch; cast to QueueErrorInput for classification (covers Error|string|object).
      const classifiedError = classifyQueueError(error as QueueErrorInput);
      await db
        .update(resumes)
        .set({
          status: "failed",
          // Issue #91 Fix: Store JSON format for DLQ/retry consumers to parse
          lastAttemptError: JSON.stringify(classifiedError.toJSON()),
        })
        .where(and(ne(resumes.status, "completed"), eq(resumes.id, message.resumeId)));
      await notifyStatusChange({
        resumeId: message.resumeId,
        status: "failed",
        error: classifiedError.message,
        env,
      });

      // Permanent errors are acked (discarded) by the worker and never reach the
      // DLQ, so the consumer is the ONLY place that can alert for them. Without
      // this, permanent failures (invalid_pdf, file_not_found, ...) never alert.
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
      // Retryable error - just record the error for debugging, don't change status
      // SAFETY: error is unknown from catch; QueueErrorInput covers classification cases.
      const classifiedError = classifyQueueError(error as QueueErrorInput);
      await db
        .update(resumes)
        .set({
          // Issue #91 Fix: Store JSON format for DLQ/retry consumers to parse
          lastAttemptError: JSON.stringify(classifiedError.toJSON()),
        })
        .where(eq(resumes.id, message.resumeId));
    }

    // Re-throw so the worker can decide whether to retry
    throw error;
  }
}
