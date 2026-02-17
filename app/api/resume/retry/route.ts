import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { hasExceededMaxAttempts, isPermanentErrorType, RETRY_LIMITS } from "@/lib/config/retry";
import type { NewResume } from "@/lib/db/schema";
import { resumes } from "@/lib/db/schema";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import { getR2Binding, R2 } from "@/lib/r2";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

interface RetryRequestBody {
  resume_id?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Check authentication and validate user exists in database
    const {
      user: authUser,
      db,
      captureBookmark,
      env,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to retry resume parsing");
    if (authError) return authError;

    const userId = authUser.id;
    const typedEnv = env as Partial<CloudflareEnv>;

    // Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    let body: RetryRequestBody;
    try {
      body = (await request.json()) as RetryRequestBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { resume_id } = body;

    if (!resume_id) {
      return createErrorResponse(
        "resume_id is required in request body",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // 2. Fetch resume from database including idempotency fields and fileHash
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, resume_id),
      columns: {
        id: true,
        userId: true,
        r2Key: true,
        status: true,
        retryCount: true,
        totalAttempts: true,
        lastAttemptError: true,
        fileHash: true,
      },
    });

    if (!resume) {
      return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
    }

    // 3. Verify ownership
    if (resume.userId !== userId) {
      return createErrorResponse(
        "You do not have permission to retry this resume",
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }

    // 4a. Check if max total attempts exceeded
    if (hasExceededMaxAttempts(resume.totalAttempts ?? 0)) {
      return createErrorResponse(
        "Maximum retry attempts exceeded. This resume cannot be retried.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
        {
          max_attempts: RETRY_LIMITS.TOTAL_MAX_ATTEMPTS,
          current_attempts: resume.totalAttempts,
        },
      );
    }

    // 4b. Check if last error was permanent (shouldn't retry)
    if (resume.lastAttemptError) {
      try {
        const lastError = JSON.parse(resume.lastAttemptError);
        if (isPermanentErrorType(lastError.type)) {
          return createErrorResponse(
            `This resume failed with a permanent error (${lastError.type}). Retrying will not help.`,
            ERROR_CODES.VALIDATION_ERROR,
            400,
            { error_type: lastError.type, error_message: lastError.message },
          );
        }
      } catch {
        // Ignore parse errors, allow retry
      }
    }

    // 4c. Verify retry eligibility - status check
    if (resume.status !== "failed") {
      return createErrorResponse(
        "Can only retry failed resumes",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { current_status: resume.status },
      );
    }

    // 4d. Check manual retry limit
    if ((resume.retryCount as number) >= RETRY_LIMITS.MANUAL_MAX_RETRIES) {
      return createErrorResponse(
        "Maximum retry limit reached. Please upload a new resume.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
        {
          max_retries: RETRY_LIMITS.MANUAL_MAX_RETRIES,
          current_retry_count: resume.retryCount as number,
        },
      );
    }

    // 5. Get file hash -- use stored hash if available, fall back to R2 download for legacy rows
    let fileHash: string;

    if (resume.fileHash) {
      fileHash = resume.fileHash;
    } else {
      // Legacy fallback: download from R2 and compute hash
      const r2Binding = getR2Binding(typedEnv);
      if (!r2Binding) {
        return createErrorResponse(
          "Storage service unavailable",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      let pdfBuffer: Uint8Array;

      try {
        const fileBuffer = await R2.getAsUint8Array(r2Binding, resume.r2Key as string);

        if (!fileBuffer) {
          return createErrorResponse(
            "Failed to download file for processing",
            ERROR_CODES.EXTERNAL_SERVICE_ERROR,
            500,
          );
        }

        pdfBuffer = fileBuffer;
      } catch (error) {
        console.error("R2 download error:", error);
        return createErrorResponse(
          "Failed to download file for processing",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      // Compute SHA-256 hash from downloaded PDF
      const bufferCopy = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength,
      ) as ArrayBuffer;
      const hashBuffer = await crypto.subtle.digest("SHA-256", bufferCopy);
      fileHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // Publish to queue for background processing
    const queue = typedEnv.RESUME_PARSE_QUEUE;
    if (!queue) {
      return createErrorResponse("Queue service unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    await publishResumeParse(queue, {
      resumeId: resume.id as string,
      userId,
      r2Key: resume.r2Key as string,
      fileHash,
      attempt: (resume.retryCount as number) + 1,
    });

    const updatePayload: Partial<NewResume> = {
      status: "queued",
      errorMessage: null,
      retryCount: (resume.retryCount as number) + 1,
      queuedAt: new Date().toISOString(),
    };

    const updateResult = await db
      .update(resumes)
      .set(updatePayload)
      .where(eq(resumes.id, resume_id))
      .returning({ id: resumes.id });

    if (updateResult.length === 0) {
      console.error("Failed to update resume for retry");
      return createErrorResponse("Failed to update resume status", ERROR_CODES.DATABASE_ERROR, 500);
    }

    await captureBookmark();

    return createSuccessResponse({
      resume_id: resume.id as string,
      status: "queued",
      retry_count: (resume.retryCount as number) + 1,
    });
  } catch (error) {
    console.error("Error retrying resume parsing:", error);
    return createErrorResponse(
      "An unexpected error occurred while retrying",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
