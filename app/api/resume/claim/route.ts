import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { resumes, siteData } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { getR2Bucket, getR2Client } from "@/lib/r2";
import { parseResume } from "@/lib/replicate";
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
 * POST /api/resume/claim
 * Claims an anonymous upload and triggers AI parsing
 * Rate limit: 5 uploads per 24 hours
 */
export async function POST(request: Request) {
  try {
    // Get Cloudflare env bindings for R2/Replicate secrets
    const { env } = await getCloudflareContext({ async: true });
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
        // Update new resume to completed with cached content (skip Replicate entirely)
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
          const parsedContent = JSON.parse(cached[0].parsedContent);

          // Copy content to user's site_data for publishing (upsert)
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
                content: JSON.stringify(parsedContent),
                lastPublishedAt: now,
                updatedAt: now,
              })
              .where(eq(siteData.userId, userId));
          } else {
            await db.insert(siteData).values({
              id: crypto.randomUUID(),
              userId,
              resumeId,
              content: JSON.stringify(parsedContent),
              lastPublishedAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Still need to move the file from temp to user folder
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

            // R2 operations succeeded - return cached result
            await captureBookmark();
            return createSuccessResponse({
              resume_id: resumeId,
              status: "completed",
              cached: true,
            });
          } catch (error) {
            console.error("R2 operations failed for cached resume:", error);
            // SECURITY FIX: R2 failure means file isn't properly moved
            // Reset status and fall through to normal processing
            await db
              .update(resumes)
              .set({ status: "pending_claim", parsedAt: null, parsedContent: null })
              .where(eq(resumes.id, resumeId));
            // Fall through to normal processing path
          }
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

    // 10. Generate presigned URL for Replicate (7 day expiry)
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: newKey,
    });

    let presignedUrl: string;
    try {
      presignedUrl = await getSignedUrl(r2Client, getCommand, {
        expiresIn: 7 * 24 * 60 * 60, // 7 days
      });
    } catch (error) {
      console.error("Presigned URL generation error:", error);
      return await failResume(
        "Failed to prepare file for processing",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 11. Trigger Replicate parsing with webhook
    let replicateJobId: string | null = null;
    let parseError: string | null = null;

    // Build webhook URL for Replicate to call when done
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const webhookUrl = appUrl ? `${appUrl}/api/webhook/replicate` : undefined;

    try {
      const prediction = await parseResume(presignedUrl, webhookUrl, typedEnv);
      replicateJobId = prediction.id;
    } catch (error) {
      console.error("Failed to trigger Replicate parsing:", error);
      parseError = error instanceof Error ? error.message : "Failed to start AI parsing";
    }

    // 12. Update resume with replicate job ID or error (include file_hash for future caching)
    const updatePayload: {
      status: "processing" | "failed";
      replicateJobId?: string;
      errorMessage?: string;
      fileHash?: string;
    } = replicateJobId
      ? {
          status: "processing",
          replicateJobId,
          ...(file_hash && { fileHash: file_hash }),
        }
      : {
          status: "failed",
          errorMessage: parseError || "Unknown error",
        };

    try {
      await db.update(resumes).set(updatePayload).where(eq(resumes.id, resumeId));
    } catch (updateError) {
      console.error("Failed to update resume with replicate job:", updateError);
      // Continue anyway - status endpoint will handle it
    }

    await captureBookmark();
    return createSuccessResponse({
      resume_id: resumeId,
      status: updatePayload.status,
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
