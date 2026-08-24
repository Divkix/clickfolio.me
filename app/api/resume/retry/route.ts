import { and, eq, lt } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/posthog-server";
import { RETRY_LIMITS } from "@/lib/resume/lifecycle";
import type { NewResume } from "@/lib/db/schema";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { resumes } from "@/lib/db/schema";
import { checkRetryEligibility, waitingForCacheTimedOut } from "@/lib/resume/lifecycle";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import { getR2Binding, R2 } from "@/lib/r2";
import { sha256Hex } from "@/lib/utils/hash";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

interface RetryRequestBody {
  resume_id?: string;
}

/**
 * POST /api/resume/retry
 * Retry endpoint for failed resumes.
 *
 * Request body:
 *   { resume_id: string }
 *
 * Retry eligibility checks:
 *   - Max total attempts not exceeded (RETRY_LIMITS.TOTAL_MAX_ATTEMPTS)
 *   - Last error is not a permanent error type
 *   - Resume status is "failed"
 *   - Manual retry count < RETRY_LIMITS.MANUAL_MAX_RETRIES
 *
 * R2 fallback chain:
 *   - Uses stored fileHash if available
 *   - Falls back to downloading from R2 and computing SHA-256 for legacy rows
 *
 * Queue publishing:
 *   - Updates resume status to "queued" BEFORE publishing to prevent race conditions
 *   - Publishes to CLICKFOLIO_PARSE_QUEUE with resumeId, userId, r2Key, fileHash, attempt
 *
 * Rollback behavior:
 *   - On queue publish failure, rolls back status to "failed" and restores previous retryCount
 *
 * Error codes:
 *   - 400: missing resume_id, permanent error type, or resume not in failed state
 *   - 403: resume belongs to another user
 *   - 404: resume not found
 *   - 409: resume was concurrently retried or its status changed (TOCTOU race)
 *   - 429: max total attempts or manual retries exceeded
 *   - 500: storage unavailable, download failure, queue unavailable, or unexpected error
 */
export async function POST(request: Request) {
  return withUser(
    request,
    async ({ user: authUser, db, env }) => {
      const userId = authUser.id;

      // Validate request size before parsing (prevent DoS)
      const sizeCheck = validateRequestSize(request);
      if (!sizeCheck.valid) {
        return createErrorResponse(
          sizeCheck.error || "Request body too large",
          ERROR_CODES.BAD_REQUEST,
          413,
        );
      }

      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }
      // SAFETY: rawBodyResult.data is bounded JSON, cast to RetryRequestBody for field access.
      const body = rawBodyResult.data as RetryRequestBody;
      const { resume_id } = body;

      if (!resume_id) {
        return createErrorResponse(
          "resume_id is required in request body",
          ERROR_CODES.BAD_REQUEST,
          400,
        );
      }

      // Fetch resume from database including idempotency fields and fileHash
      const resume = await db.query.resumes.findFirst({
        where: eq(resumes.id, resume_id),
        columns: {
          id: true,
          userId: true,
          r2Key: true,
          status: true,
          errorMessage: true,
          retryCount: true,
          totalAttempts: true,
          lastAttemptError: true,
          fileHash: true,
          createdAt: true,
        },
      });

      if (!resume) {
        return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
      }

      // Verify ownership
      if (resume.userId !== userId) {
        return createErrorResponse(
          "You do not have permission to retry this resume",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }
      // Canonical eligibility — single source of truth for the 4 gates.
      // A `waiting_for_cache` row that has timed out is presented virtually as
      // `failed` by GET /status; accept an immediate manual retry without waiting
      // for the cron to durably persist the timeout (otherwise can_retry=true in
      // the UI would be denied here until the next 15m tick).
      // SAFETY: status and createdAt are validated enum/string columns; casts bridge Drizzle nullable type to ResumeStatus for lifecycle helpers.
      const isVirtualTimeout = waitingForCacheTimedOut({
        status: resume.status as ResumeStatus,
        createdAt: resume.createdAt as string | null,
      });
      // SAFETY: status/retry fields are validated enum/number columns; casts bridge Drizzle type to ResumeStatus for eligibility check.
      const eligibility = checkRetryEligibility({
        status: isVirtualTimeout ? "failed" : (resume.status as ResumeStatus),
        retryCount: resume.retryCount as number,
        totalAttempts: resume.totalAttempts as number,
        lastAttemptError: isVirtualTimeout ? null : (resume.lastAttemptError as string | null),
      });
      if (!eligibility.eligible) {
        // SAFETY: eligibility.errorCode is validated against ERROR_CODES keys; cast narrows string to known enum key.
        return createErrorResponse(
          eligibility.reason,
          ERROR_CODES[eligibility.errorCode as keyof typeof ERROR_CODES],
          eligibility.httpStatus,
          eligibility.details,
        );
      }

      // Get file hash -- use stored hash if available, fall back to R2 download for legacy rows
      let fileHash: string;

      if (resume.fileHash) {
        fileHash = resume.fileHash;
      } else {
        // Legacy fallback: download from R2 and compute hash
        const r2Binding = getR2Binding(env);
        if (!r2Binding) {
          return createErrorResponse(
            "Storage service unavailable",
            ERROR_CODES.EXTERNAL_SERVICE_ERROR,
            500,
          );
        }
        let pdfBuffer: Uint8Array;

        try {
          // SAFETY: r2Key is validated R2 key written only by our upload flow; cast bridges nullable Drizzle type.
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
        // SAFETY: pdfBuffer is Uint8Array from R2; slice produces ArrayBuffer for sha256Hex.
        const bufferCopy = pdfBuffer.buffer.slice(
          pdfBuffer.byteOffset,
          pdfBuffer.byteOffset + pdfBuffer.byteLength,
        ) as ArrayBuffer;
        fileHash = await sha256Hex(bufferCopy);
      }
      // Update resume status to queued BEFORE publishing to queue (prevents race condition)
      // SAFETY: retryCount is integer column; cast bridges Drizzle nullable to number.
      const previousRetryCount = resume.retryCount as number;
      const nextRetryCount = previousRetryCount + 1;
      const updatePayload: Partial<NewResume> = {
        status: "queued",
        errorMessage: null,
        retryCount: nextRetryCount,
        queuedAt: new Date().toISOString(),
      };

      // TOCTOU guard: for a virtual timeout the row is still `waiting_for_cache`
      // in the DB, so guard on that status; otherwise guard on `failed`.
      const statusGuard = isVirtualTimeout
        ? eq(resumes.status, "waiting_for_cache")
        : eq(resumes.status, "failed");

      const updateResult = await db
        .update(resumes)
        .set(updatePayload)
        .where(
          and(
            eq(resumes.id, resume_id),
            // TOCTOU guard: only re-queue if the row is STILL in its expected
            // status AND still under the manual-retry cap. A concurrent manual
            // retry, the queue consumer, or orphan recovery may have moved it
            // between the read above and this UPDATE.
            statusGuard,
            lt(resumes.retryCount, RETRY_LIMITS.MANUAL_MAX_RETRIES),
          ),
        )
        .returning({ id: resumes.id });

      if (updateResult.length === 0) {
        // The row changed between our read and this update — this is a race
        // (concurrent retry / status change), not a storage failure.
        return createErrorResponse(
          "Resume was already retried or is no longer in a retryable state",
          ERROR_CODES.CONFLICT,
          409,
        );
      }
      const rollbackRetryUpdate = async () => {
        try {
          // For a virtual timeout the original status was `waiting_for_cache`; a
          // rollback should restore that, not `failed`, so the row is not left in
          // a persistently-timed-out state before the cron ticks. For normal
          // retries the original status was already `failed`, so this is a no-op
          // change — but keep it explicit for clarity.
          const rollbackStatus = isVirtualTimeout ? "waiting_for_cache" : "failed";
          await db
            .update(resumes)
            .set({
              // SAFETY: rollbackStatus is validated enum value; cast bridges string to Drizzle insert type.
              status: rollbackStatus as typeof resumes.$inferInsert.status,
              errorMessage: resume.errorMessage,
              retryCount: previousRetryCount,
              queuedAt: null,
            })
            .where(eq(resumes.id, resume_id));
        } catch (rollbackError) {
          console.error("Failed to roll back retry queue state:", rollbackError);
        }
      };

      // Publish to queue for background processing (after DB update to prevent race)
      const queue = env.CLICKFOLIO_PARSE_QUEUE;
      if (!queue) {
        await rollbackRetryUpdate();
        return createErrorResponse("Queue service unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
      }

      try {
        // SAFETY: id and r2Key are validated string columns; casts bridge Drizzle type to string for queue payload.
        await publishResumeParse(queue, {
          resumeId: resume.id as string,
          userId,
          r2Key: resume.r2Key as string,
          fileHash,
          attempt: nextRetryCount,
        });
      } catch (queueError) {
        await rollbackRetryUpdate();
        console.error("Failed to publish retry parse job:", queueError);
        return createErrorResponse("Queue service unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
      }

      // SAFETY: id is a validated string PK; cast bridges Drizzle type for event payload.
      await captureServerEvent(userId, "resume_parse_retried", {
        resume_id: resume.id as string,
        retry_count: nextRetryCount,
      });

      // SAFETY: id is a validated string PK; cast bridges Drizzle type for response payload.
      return createSuccessResponse({
        resume_id: resume.id as string,
        status: "queued",
        retry_count: nextRetryCount,
      });
    },
    "You must be logged in to retry resume parsing",
  );
}
