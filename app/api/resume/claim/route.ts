import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import type { NewResume } from "@/lib/db/schema";
import { resumes, siteData } from "@/lib/db/schema";
import type { getSessionDb } from "@/lib/db/session";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import { getR2Binding, R2 } from "@/lib/r2";
import { writeReferral } from "@/lib/referral";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { MAX_FILE_SIZE, validateRequestSize } from "@/lib/utils/validation";

interface ClaimRequestBody {
  key?: string;
  referral_handle?: string;
}

/**
 * Upsert site_data with UNIQUE constraint handling
 * Handles race conditions where another request may have inserted between SELECT and INSERT
 */
async function upsertSiteData(
  db: Awaited<ReturnType<typeof getSessionDb>>["db"],
  userId: string,
  resumeId: string,
  content: string,
  now: string,
): Promise<void> {
  // First try to update existing record
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
    // Try to insert, handle UNIQUE constraint race condition
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
        // Another request inserted between our SELECT and INSERT, update instead
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
 * POST /api/resume/claim
 * Claims an anonymous upload and triggers AI parsing
 * Rate limit: 5 uploads per 24 hours
 */
export async function POST(request: Request) {
  try {
    // Get Cloudflare env bindings for R2/Gemini secrets
    const { env } = await getCloudflareContext({ async: true });
    const typedEnv = env as Partial<CloudflareEnv>;

    // Get R2 binding for direct operations
    const r2Binding = getR2Binding(typedEnv);
    if (!r2Binding) {
      return createErrorResponse(
        "Storage service unavailable",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 1. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    // 2. Check authentication and validate user exists in database
    const {
      user: authUser,
      db,
      captureBookmark,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to claim a resume", env.DB);
    if (authError) return authError;

    const userId = authUser.id;

    // 3. Parse request body
    let body: ClaimRequestBody;
    try {
      body = (await request.json()) as ClaimRequestBody;
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const { key } = body;

    if (!key || !key.startsWith("temp/")) {
      return createErrorResponse(
        "Invalid upload key. Must be a temporary upload.",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // 4. Rate limiting check (5 uploads per 24 hours)
    const rateLimitResponse = await enforceRateLimit(userId, "resume_upload");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 4b. Fetch file and compute SHA-256 hash server-side (early fetch for validation + caching)
    let fileBuffer: ArrayBuffer;
    let computedFileHash: string;

    try {
      const buffer = await R2.getAsArrayBuffer(r2Binding, key);
      if (!buffer) {
        return createErrorResponse(
          "File not found. The upload may have expired.",
          ERROR_CODES.VALIDATION_ERROR,
          404,
        );
      }
      fileBuffer = buffer;

      // Compute hash (this is now authoritative, not verification)
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      computedFileHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Validate file size using buffer
      if (fileBuffer.byteLength > MAX_FILE_SIZE) {
        return createErrorResponse(
          `File size exceeds 5MB limit (${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB)`,
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }

      // Validate PDF magic number
      const pdfBytes = new Uint8Array(fileBuffer.slice(0, 5));
      if (!String.fromCharCode(...pdfBytes).startsWith("%PDF-")) {
        return createErrorResponse("Invalid PDF format", ERROR_CODES.VALIDATION_ERROR, 400);
      }
    } catch (error) {
      console.error("Error fetching file from R2:", error);
      return createErrorResponse(
        "Failed to retrieve file. The upload may have expired.",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 5. Generate new key and insert DB record FIRST
    // This ensures we always have a record for tracking, even if R2 operations fail
    const timestamp = Date.now();
    const filename = key.split("/").pop();
    const newKey = `users/${userId}/${timestamp}/${filename}`;
    const resumeId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await db.insert(resumes).values({
        id: resumeId,
        userId,
        r2Key: newKey,
        status: "pending_claim",
        createdAt: now,
      });
    } catch (insertError) {
      console.error("Database insert error:", insertError);
      return createErrorResponse(
        "Failed to create resume record. Please try again.",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    // 5a. Link referral if provided (best effort - don't fail claim on referral errors)
    if (body.referral_handle) {
      try {
        const referralResult = await writeReferral(userId, body.referral_handle, request);
        if (!referralResult.success) {
          console.log(`Referral not linked: ${referralResult.reason}`);
        }
      } catch (referralError) {
        console.error("Referral linking error:", referralError);
        // Don't fail the claim for referral errors
      }
    }

    // 5b. Check for cached parse result (same file uploaded before BY THIS USER)
    // SECURITY: Only look up cache for current user's own resumes to prevent cross-user data access
    // Step 1: Existence check - only fetch id to avoid loading 100KB+ parsedContent unnecessarily
    const hasCache = await db
      .select({ id: resumes.id })
      .from(resumes)
      .where(
        and(
          eq(resumes.userId, userId),
          eq(resumes.fileHash, computedFileHash),
          eq(resumes.status, "completed"),
          isNotNull(resumes.parsedContent),
          ne(resumes.id, resumeId),
        ),
      )
      .limit(1);

    // Step 2: Only fetch content if cache exists
    let cachedContent: string | null = null;
    if (hasCache.length > 0) {
      const result = await db
        .select({ parsedContent: resumes.parsedContent })
        .from(resumes)
        .where(eq(resumes.id, hasCache[0].id))
        .limit(1);
      cachedContent = result[0]?.parsedContent as string | null;
    }

    if (cachedContent) {
      // DATA INTEGRITY FIX: Store file to user's folder using existing buffer
      // No need to copy from temp - we already have the file in memory
      let r2PutSucceeded = false;
      try {
        await R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" });
        r2PutSucceeded = true;
        // Clean up temp file (best effort)
        try {
          await R2.delete(r2Binding, key);
        } catch (deleteError) {
          console.warn("R2 delete failed for cached resume path:", deleteError);
        }
      } catch (r2Error) {
        console.error("R2 operations failed for cached resume:", r2Error);
        // R2 failed - don't update DB, fall through to normal processing
        // The resume record stays in pending_claim status
      }

      // Only update DB if R2 put succeeded
      if (r2PutSucceeded) {
        try {
          await db
            .update(resumes)
            .set({
              status: "completed",
              fileHash: computedFileHash,
              parsedAt: now,
              parsedContent: cachedContent,
            })
            .where(eq(resumes.id, resumeId));

          // Copy content to user's site_data for publishing (upsert with race condition handling)
          // Pass raw string directly - already valid JSON, avoid parse-stringify round-trip
          await upsertSiteData(db, userId, resumeId, cachedContent, now);

          // R2 and DB both succeeded - return cached result
          await captureBookmark();
          return createSuccessResponse({
            resume_id: resumeId,
            status: "completed",
            cached: true,
          });
        } catch (updateError) {
          console.error("Failed to update resume with cached content:", updateError);
          // Fall through to normal parsing path
        }
      }
    }

    // 5c. Check if another resume with same hash is currently processing
    // If so, wait for it instead of triggering duplicate parsing
    // SECURITY: Only look for processing resumes from the same user
    const processing = await db
      .select({ id: resumes.id })
      .from(resumes)
      .where(
        and(
          eq(resumes.userId, userId),
          eq(resumes.fileHash, computedFileHash),
          eq(resumes.status, "processing"),
          ne(resumes.id, resumeId),
        ),
      )
      .limit(1);

    if (processing[0]) {
      // This user is already parsing this file - wait for that result
      // Store file to user's folder using existing buffer
      let r2PutSucceeded = false;
      try {
        await R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" });
        r2PutSucceeded = true;
        // Clean up temp file (best effort)
        try {
          await R2.delete(r2Binding, key);
        } catch (deleteError) {
          console.warn("R2 delete failed for waiting_for_cache path:", deleteError);
        }
      } catch (error) {
        console.error("R2 operations failed for waiting resume:", error);
      }

      // Only update DB and return if R2 put succeeded
      if (r2PutSucceeded) {
        try {
          await db
            .update(resumes)
            .set({
              status: "waiting_for_cache",
              fileHash: computedFileHash,
            })
            .where(eq(resumes.id, resumeId));

          await captureBookmark();
          return createSuccessResponse({
            resume_id: resumeId,
            status: "processing", // Client sees "processing" and subscribes to realtime
            waiting_for_cache: true,
          });
        } catch (waitError) {
          console.error("Failed to set waiting_for_cache status:", waitError);
          // Fall through to normal processing
        }
      }
    }

    // Helper to mark resume as failed and return error
    const failResume = async (errorMessage: string, errorCode: string, statusCode: number) => {
      await db
        .update(resumes)
        .set({ status: "failed", errorMessage })
        .where(eq(resumes.id, resumeId));

      return createErrorResponse(errorMessage, errorCode, statusCode);
    };

    // 6. Store file to user's folder using already-fetched buffer
    // (File size and PDF validation already done in step 4b)
    try {
      await R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" });
    } catch (error) {
      console.error("R2 put error:", error);
      return await failResume(
        "Failed to store file for processing",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 7. Delete temp object (best effort - not critical if fails)
    // Can be cleaned up by R2 lifecycle rules if this fails
    try {
      await R2.delete(r2Binding, key);
    } catch (error) {
      console.error("R2 delete error:", error);
      // Continue - temp file cleanup failure is not critical
    }

    // 8. Publish to queue for background processing
    const queue = typedEnv.RESUME_PARSE_QUEUE;
    if (!queue) {
      return await failResume("Queue service unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    await publishResumeParse(queue, {
      resumeId,
      userId,
      r2Key: newKey,
      fileHash: computedFileHash,
      attempt: 1,
    });

    // 9. Update resume status to queued (include hash for future caching)
    const updatePayload: Partial<NewResume> = {
      status: "queued",
      fileHash: computedFileHash,
    };

    try {
      await db.update(resumes).set(updatePayload).where(eq(resumes.id, resumeId));
    } catch (updateError) {
      console.error("Failed to update resume with queued status:", updateError);
      // Continue anyway - status endpoint will handle it
    }

    await captureBookmark();
    return createSuccessResponse({
      resume_id: resumeId,
      status: "queued",
    });
  } catch (error) {
    console.error("Error claiming resume:", error);
    return createErrorResponse(
      "An unexpected error occurred while claiming your resume",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
