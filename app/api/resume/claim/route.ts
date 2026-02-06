import { and, desc, eq, gte, isNotNull, ne } from "drizzle-orm";
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
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL, validateRequestSize } from "@/lib/utils/validation";

interface ClaimRequestBody {
  key?: string;
  referral_code?: string;
}

/**
 * Build siteData upsert query (not executed).
 * Returned so callers can include it in a db.batch() call for atomicity.
 */
function buildSiteDataUpsert(
  db: Awaited<ReturnType<typeof getSessionDb>>["db"],
  userId: string,
  resumeId: string,
  content: string,
  now: string,
) {
  return db
    .insert(siteData)
    .values({
      id: crypto.randomUUID(),
      userId,
      resumeId,
      content,
      lastPublishedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteData.userId,
      set: {
        resumeId,
        content,
        lastPublishedAt: now,
        updatedAt: now,
      },
    });
}

/**
 * POST /api/resume/claim
 * Claims an anonymous upload and triggers AI parsing
 * Rate limit: 5 uploads per 24 hours
 */
export async function POST(request: Request) {
  try {
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
    // env is returned from requireAuthWithUserValidation, no separate getCloudflareContext needed
    const {
      user: authUser,
      db,
      captureBookmark,
      env,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to claim a resume");
    if (authError) return authError;

    const userId = authUser.id;

    // 3. Get R2 binding for direct operations (uses env from auth result)
    const r2Binding = getR2Binding(env);
    if (!r2Binding) {
      return createErrorResponse(
        "Storage service unavailable",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 4. Parse request body
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

    // 5. Rate limiting check (5 uploads per 24 hours)
    // Pass env to avoid redundant getCloudflareContext call in rate limiter
    const rateLimitResponse = await enforceRateLimit(userId, "resume_upload", env);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 5b. Fetch file and compute SHA-256 hash server-side (early fetch for validation + caching)
    let fileBuffer: ArrayBuffer;
    let computedFileHash: string;

    try {
      const buffer = await R2.getAsArrayBuffer(r2Binding, key);
      if (!buffer) {
        // Double-claim guard: auth redirect causes wizard to mount twice,
        // second mount tries to claim a file already moved by the first.
        // Check if this user already has a recent resume (created in last 2 min).
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const recentResume = await db
          .select({ id: resumes.id, status: resumes.status })
          .from(resumes)
          .where(and(eq(resumes.userId, userId), gte(resumes.createdAt, twoMinAgo)))
          .orderBy(desc(resumes.createdAt))
          .limit(1);

        if (recentResume[0]) {
          return createSuccessResponse({
            resume_id: recentResume[0].id,
            status: recentResume[0].status,
            already_claimed: true,
          });
        }

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
          `File size exceeds ${MAX_FILE_SIZE_LABEL} limit (${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB)`,
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

    // 6. Generate new key and insert DB record FIRST
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

    // 6a. Link referral if provided (best effort - don't fail claim on referral errors)
    if (body.referral_code) {
      try {
        const referralResult = await writeReferral(userId, body.referral_code, request);
        if (!referralResult.success) {
          console.log(`Referral not linked: ${referralResult.reason}`);
        }
      } catch (referralError) {
        console.error("Referral linking error:", referralError);
        // Don't fail the claim for referral errors
      }
    }

    // 6b. Check for cached parse result (same file uploaded before BY THIS USER)
    // SECURITY: Only look up cache for current user's own resumes to prevent cross-user data access
    // Single query to fetch both existence and content (saves one D1 roundtrip)
    const cached = await db
      .select({ id: resumes.id, parsedContent: resumes.parsedContent })
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

    const cachedContent = cached[0]?.parsedContent as string | null;

    if (cachedContent) {
      // DATA INTEGRITY FIX: Store file to user's folder using existing buffer
      // No need to copy from temp - we already have the file in memory
      let r2PutSucceeded = false;
      try {
        // Parallelize R2 operations: put must succeed, delete is best-effort
        await Promise.all([
          R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" }),
          R2.delete(r2Binding, key).catch((err) =>
            console.warn("R2 delete failed for cached resume path:", err),
          ),
        ]);
        r2PutSucceeded = true;
      } catch (r2Error) {
        console.error("R2 operations failed for cached resume:", r2Error);
        // R2 failed - don't update DB, fall through to normal processing
        // The resume record stays in pending_claim status
      }

      // Only update DB if R2 put succeeded
      if (r2PutSucceeded) {
        try {
          // Batch resume completion + siteData upsert atomically.
          // Without batching, a crash between the UPDATE and upsert leaves
          // the resume "completed" with no siteData, and the idempotency
          // guard in the queue consumer skips it on retry.
          await db.batch([
            db
              .update(resumes)
              .set({
                status: "completed",
                fileHash: computedFileHash,
                parsedAt: now,
                parsedContent: cachedContent,
              })
              .where(eq(resumes.id, resumeId)),
            buildSiteDataUpsert(db, userId, resumeId, cachedContent, now),
          ]);

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

    // 6c. Check if another resume with same hash is currently processing
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
        // Parallelize R2 operations: put must succeed, delete is best-effort
        await Promise.all([
          R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" }),
          R2.delete(r2Binding, key).catch((err) =>
            console.warn("R2 delete failed for waiting_for_cache path:", err),
          ),
        ]);
        r2PutSucceeded = true;
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

    // 7. Store file and cleanup temp in parallel
    // R2.put must succeed, R2.delete is best-effort (can be cleaned by lifecycle rules if fails)
    try {
      await Promise.all([
        R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" }),
        R2.delete(r2Binding, key).catch((err) => console.error("R2 delete error:", err)),
      ]);
    } catch (error) {
      console.error("R2 put error:", error);
      return await failResume(
        "Failed to store file for processing",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 8. Publish to queue for background processing
    const queue = env.RESUME_PARSE_QUEUE;
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
