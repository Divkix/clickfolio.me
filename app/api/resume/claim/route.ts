import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Bucket, getR2Client } from "@/lib/r2";
import { parseResume } from "@/lib/replicate";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { MAX_FILE_SIZE, validatePDFMagicNumber, validateRequestSize } from "@/lib/utils/validation";

/**
 * POST /api/resume/claim
 * Claims an anonymous upload and triggers AI parsing
 * Rate limit: 5 uploads per 24 hours
 */
export async function POST(request: Request) {
  try {
    // Initialize R2 client and bucket
    const r2Client = getR2Client();
    const R2_BUCKET = getR2Bucket();

    // 1. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    const supabase = await createClient();

    // 2. Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse(
        "You must be logged in to claim a resume",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    // 3. Parse request body
    let body;
    try {
      body = await request.json();
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
    const rateLimitResponse = await enforceRateLimit(user.id, "resume_upload");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 5. Generate new key and insert DB record FIRST
    // This ensures we always have a record for tracking, even if R2 operations fail
    const timestamp = Date.now();
    const filename = key.split("/").pop();
    const newKey = `users/${user.id}/${timestamp}/${filename}`;

    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        r2_key: newKey, // Planned key, R2 move will happen next
        status: "pending_claim",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return createErrorResponse(
        "Failed to create resume record. Please try again.",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    // 5b. Check for cached parse result (same file uploaded before BY THIS USER)
    // NOTE: We read parsed_content from resumes table, NOT site_data
    // because site_data gets overwritten on each new upload (onConflict: "user_id")
    // SECURITY: Only look up cache for current user's own resumes to prevent cross-user data access
    if (file_hash) {
      const { data: cached } = await supabase
        .from("resumes")
        .select("id, parsed_content")
        .eq("user_id", user.id) // CRITICAL: Only access current user's cached resumes
        .eq("file_hash", file_hash)
        .eq("status", "completed")
        .not("parsed_content", "is", null) // Must have cached content
        .neq("id", resume.id) // Exclude current resume
        .limit(1)
        .maybeSingle();

      if (cached?.parsed_content) {
        // Update new resume to completed with cached content (skip Replicate entirely)
        const { error: resumeUpdateError } = await supabase
          .from("resumes")
          .update({
            status: "completed",
            file_hash,
            parsed_at: new Date().toISOString(),
            parsed_content: cached.parsed_content, // Copy cached content
          })
          .eq("id", resume.id);

        if (resumeUpdateError) {
          console.error("Failed to update resume with cached content:", resumeUpdateError);
          // Fall through to normal parsing path
        } else {
          // Copy content to user's site_data for publishing
          const { error: siteDataError } = await supabase.from("site_data").upsert(
            {
              user_id: user.id,
              resume_id: resume.id,
              content: cached.parsed_content,
              last_published_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

          if (siteDataError) {
            console.error("Failed to upsert site_data with cached content:", siteDataError);
            // Fall through to normal parsing path - reset resume status
            await supabase
              .from("resumes")
              .update({ status: "pending_claim", parsed_at: null, parsed_content: null })
              .eq("id", resume.id);
          } else {
            // Still need to move the file from temp to user folder
            // (but we skip the expensive Replicate API call)
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
              return createSuccessResponse({
                resume_id: resume.id,
                status: "completed",
                cached: true,
              });
            } catch (error) {
              console.error("R2 operations failed for cached resume:", error);
              // SECURITY FIX: R2 failure means file isn't properly moved
              // Reset status and fall through to normal processing instead of returning success
              await supabase
                .from("resumes")
                .update({ status: "pending_claim", parsed_at: null, parsed_content: null })
                .eq("id", resume.id);
              // Fall through to normal processing path
            }
          }
        }
      }
    }

    // 5c. Check if another resume with same hash is currently processing
    // If so, wait for it instead of triggering duplicate parsing
    // SECURITY: Only look for processing resumes from the same user
    if (file_hash) {
      const { data: processing } = await supabase
        .from("resumes")
        .select("id")
        .eq("user_id", user.id) // CRITICAL: Only access current user's resumes
        .eq("file_hash", file_hash)
        .eq("status", "processing")
        .neq("id", resume.id)
        .limit(1)
        .maybeSingle();

      if (processing) {
        // This user is already parsing this file - wait for that result
        const { error: waitError } = await supabase
          .from("resumes")
          .update({
            status: "waiting_for_cache",
            file_hash,
          })
          .eq("id", resume.id);

        if (waitError) {
          console.error("Failed to set waiting_for_cache status:", waitError);
          // Fall through to normal processing
        } else {
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

          return createSuccessResponse({
            resume_id: resume.id,
            status: "processing", // Client sees "processing" and subscribes to realtime
            waiting_for_cache: true,
          });
        }
      }
    }

    // Helper to mark resume as failed and return error
    const failResume = async (errorMessage: string, errorCode: string, statusCode: number) => {
      await supabase
        .from("resumes")
        .update({ status: "failed", error_message: errorMessage })
        .eq("id", resume.id);

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
      const prediction = await parseResume(presignedUrl, webhookUrl);
      replicateJobId = prediction.id;
    } catch (error) {
      console.error("Failed to trigger Replicate parsing:", error);
      parseError = error instanceof Error ? error.message : "Failed to start AI parsing";
    }

    // 12. Update resume with replicate job ID or error (include file_hash for future caching)
    const updatePayload: {
      status: "processing" | "failed";
      replicate_job_id?: string;
      error_message?: string;
      file_hash?: string;
    } = replicateJobId
      ? {
          status: "processing",
          replicate_job_id: replicateJobId,
          ...(file_hash && { file_hash }),
        }
      : {
          status: "failed",
          error_message: parseError || "Unknown error",
        };

    const { error: updateError } = await supabase
      .from("resumes")
      .update(updatePayload)
      .eq("id", resume.id);

    if (updateError) {
      console.error("Failed to update resume with replicate job:", updateError);
      // Continue anyway - status endpoint will handle it
    }

    return createSuccessResponse({
      resume_id: resume.id,
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
