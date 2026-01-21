import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { NewResume } from "@/lib/db/schema";
import { resumes, siteData } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { parseResumeWithGemini } from "@/lib/gemini";
import { getR2Bucket, getR2Client } from "@/lib/r2";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { MAX_FILE_SIZE, validatePDFMagicNumber, validateRequestSize } from "@/lib/utils/validation";

interface ClaimRequestBody {
  key?: string;
  file_hash?: string;
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
    const { env, ctx } = await getCloudflareContext({ async: true });
    const typedEnv = env as Partial<CloudflareEnv>;

    // Initialize R2 client and bucket with env
    const r2Client = getR2Client(typedEnv);
    const R2_BUCKET = getR2Bucket(typedEnv);

    // 1. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    // 2. Check authentication using Better Auth
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to claim a resume",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = session.user.id;

    // Get D1 database connection (env already retrieved above)
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 3. Parse request body
    let body: ClaimRequestBody;
    try {
      body = (await request.json()) as ClaimRequestBody;
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    const { key, file_hash } = body;

    if (!key || !key.startsWith("temp/")) {
      return createErrorResponse(
        "Invalid upload key. Must be a temporary upload.",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // Validate hash format if provided (64 hex chars for SHA-256)
    if (file_hash && !/^[a-f0-9]{64}$/i.test(file_hash)) {
      return createErrorResponse("Invalid file hash format", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // 4. Rate limiting check (5 uploads per 24 hours)
    const rateLimitResponse = await enforceRateLimit(userId, "resume_upload");
    if (rateLimitResponse) {
      return rateLimitResponse;
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

    // 5b. Check for cached parse result (same file uploaded before BY THIS USER)
    // SECURITY: Only look up cache for current user's own resumes to prevent cross-user data access
    if (file_hash) {
      const cached = await db
        .select({ id: resumes.id, parsedContent: resumes.parsedContent })
        .from(resumes)
        .where(
          and(
            eq(resumes.userId, userId),
            eq(resumes.fileHash, file_hash),
            eq(resumes.status, "completed"),
            isNotNull(resumes.parsedContent),
            ne(resumes.id, resumeId),
          ),
        )
        .limit(1);

      if (cached[0]?.parsedContent) {
        // DATA INTEGRITY FIX: Move R2 file FIRST before updating DB
        // If R2 fails, we fall through to normal processing without corrupting DB state
        try {
          await r2Client.send(
            new CopyObjectCommand({
              Bucket: R2_BUCKET,
              CopySource: `${R2_BUCKET}/${key}`,
              Key: newKey,
            }),
          );
          await r2Client.send(
            new DeleteObjectCommand({
              Bucket: R2_BUCKET,
              Key: key,
            }),
          );
        } catch (r2Error) {
          console.error("R2 operations failed for cached resume:", r2Error);
          // R2 failed - don't update DB, fall through to normal processing
          // The resume record stays in pending_claim status
        }

        // R2 succeeded - NOW update DB with cached content
        try {
          await db
            .update(resumes)
            .set({
              status: "completed",
              fileHash: file_hash,
              parsedAt: now,
              parsedContent: cached[0].parsedContent,
            })
            .where(eq(resumes.id, resumeId));

          // Parse the cached content for site_data
          const parsedContent = JSON.parse(cached[0].parsedContent as string);

          // Copy content to user's site_data for publishing (upsert with race condition handling)
          await upsertSiteData(db, userId, resumeId, JSON.stringify(parsedContent), now);

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
    if (file_hash) {
      const processing = await db
        .select({ id: resumes.id })
        .from(resumes)
        .where(
          and(
            eq(resumes.userId, userId),
            eq(resumes.fileHash, file_hash),
            eq(resumes.status, "processing"),
            ne(resumes.id, resumeId),
          ),
        )
        .limit(1);

      if (processing[0]) {
        // This user is already parsing this file - wait for that result
        try {
          await db
            .update(resumes)
            .set({
              status: "waiting_for_cache",
              fileHash: file_hash,
            })
            .where(eq(resumes.id, resumeId));

          // Move file to user's folder
          try {
            await r2Client.send(
              new CopyObjectCommand({
                Bucket: R2_BUCKET,
                CopySource: `${R2_BUCKET}/${key}`,
                Key: newKey,
              }),
            );
            await r2Client.send(
              new DeleteObjectCommand({
                Bucket: R2_BUCKET,
                Key: key,
              }),
            );
          } catch (error) {
            console.error("R2 operations failed for waiting resume:", error);
          }

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

    // 6. Validate file size (10MB limit)
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      });
      const headResponse = await r2Client.send(headCommand);

      if (headResponse.ContentLength && headResponse.ContentLength > MAX_FILE_SIZE) {
        const sizeInMB = Math.round(headResponse.ContentLength / 1024 / 1024);
        return await failResume(
          `File size exceeds 10MB limit (${sizeInMB}MB)`,
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }
    } catch (error) {
      console.error("File size validation error:", error);
      return await failResume(
        "Failed to validate file. The file may have expired.",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 6b. Server-side hash verification (prevent hash poisoning attacks)
    // If client provided a hash, verify it matches the actual file content
    if (file_hash) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        });
        const response = await r2Client.send(getCommand);
        const fileBuffer = await response.Body?.transformToByteArray();

        if (fileBuffer) {
          // Create a new ArrayBuffer to ensure type compatibility with crypto.subtle.digest
          const arrayBuffer = new ArrayBuffer(fileBuffer.byteLength);
          new Uint8Array(arrayBuffer).set(fileBuffer);
          const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
          const computedHash = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          if (computedHash !== file_hash.toLowerCase()) {
            return await failResume(
              "File hash mismatch - file may be corrupted",
              ERROR_CODES.VALIDATION_ERROR,
              400,
            );
          }
        }
      } catch (error) {
        console.error("Hash verification error:", error);
        // If we can't verify the hash, continue without caching benefits
        // The file will still be processed, just won't use/populate cache
      }
    }

    // 7. Validate PDF magic number before processing
    const pdfValidation = await validatePDFMagicNumber(r2Client, R2_BUCKET, key);
    if (!pdfValidation.valid) {
      return await failResume(
        pdfValidation.error || "Invalid PDF file",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    // 8. Copy object to user's folder
    try {
      await r2Client.send(
        new CopyObjectCommand({
          Bucket: R2_BUCKET,
          CopySource: `${R2_BUCKET}/${key}`,
          Key: newKey,
        }),
      );
    } catch (error) {
      console.error("R2 copy error:", error);
      return await failResume(
        "Failed to process upload. The file may have expired.",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 9. Delete temp object (best effort - not critical if fails)
    // Can be cleaned up by R2 lifecycle rules if this fails
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        }),
      );
    } catch (error) {
      console.error("R2 delete error:", error);
      // Continue - temp file cleanup failure is not critical
    }

    // 10. Download PDF for Gemini parsing
    let pdfBuffer: Uint8Array;

    try {
      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: newKey,
      });
      const response = await r2Client.send(getCommand);
      const fileBuffer = await response.Body?.transformToByteArray();

      if (!fileBuffer) {
        return await failResume(
          "Failed to download file for processing",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      pdfBuffer = new Uint8Array(fileBuffer);
    } catch (error) {
      console.error("R2 download error:", error);
      return await failResume(
        "Failed to download file for processing",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    if (!ctx?.waitUntil) {
      return await failResume(
        "Background processing is unavailable",
        ERROR_CODES.INTERNAL_ERROR,
        500,
      );
    }

    // 11. Trigger Gemini parsing in background
    const parsePromise = (async () => {
      const { db: backgroundDb, captureBookmark: captureBackgroundBookmark } = await getSessionDb(
        env.DB,
      );

      try {
        const parseResult = await parseResumeWithGemini(pdfBuffer, typedEnv);

        if (!parseResult.success) {
          const errorMessage = `Gemini API error: ${parseResult.error || "Unknown error"}`;
          await backgroundDb
            .update(resumes)
            .set({
              status: "failed",
              errorMessage,
            })
            .where(eq(resumes.id, resumeId));
          await captureBackgroundBookmark();
          return;
        }

        let parsedContent = parseResult.parsedContent;

        try {
          const parsedJson = JSON.parse(parsedContent) as Record<string, unknown>;
          parsedContent = JSON.stringify(parsedJson);
        } catch (error) {
          const errorMessage = `Gemini API error: ${error instanceof Error ? error.message : "Invalid JSON response"}`;
          await backgroundDb
            .update(resumes)
            .set({
              status: "failed",
              errorMessage,
            })
            .where(eq(resumes.id, resumeId));
          await captureBackgroundBookmark();
          return;
        }

        const now = new Date().toISOString();

        await upsertSiteData(backgroundDb, userId, resumeId, parsedContent, now);

        await backgroundDb
          .update(resumes)
          .set({
            status: "completed",
            parsedAt: now,
            parsedContent,
          })
          .where(eq(resumes.id, resumeId));

        await captureBackgroundBookmark();
      } catch (error) {
        const errorMessage = `Gemini API error: ${error instanceof Error ? error.message : "Unknown error"}`;
        await backgroundDb
          .update(resumes)
          .set({
            status: "failed",
            errorMessage,
          })
          .where(eq(resumes.id, resumeId));
        await captureBackgroundBookmark();
      }
    })();

    ctx.waitUntil(parsePromise);

    // 12. Update resume status to processing (include file_hash for future caching)
    const updatePayload: Partial<NewResume> = {
      status: "processing",
      ...(file_hash && { fileHash: file_hash }),
    };

    try {
      await db.update(resumes).set(updatePayload).where(eq(resumes.id, resumeId));
    } catch (updateError) {
      console.error("Failed to update resume with Gemini task:", updateError);
      // Continue anyway - status endpoint will handle it
    }

    await captureBookmark();
    return createSuccessResponse({
      resume_id: resumeId,
      status: "processing",
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
