import { and, eq, lt } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/analytics/server";
import { checkRetryEligibilityForRow, getStatusView, RETRY_LIMITS } from "@/lib/resume/lifecycle";
import type { NewResume } from "@/lib/db/schema";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { resumes } from "@/lib/db/schema";
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

export async function POST(request: Request) {
  return withUser(
    request,
    async ({ user: authUser, db, env }) => {
      const userId = authUser.id;

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

      if (resume.userId !== userId) {
        return createErrorResponse(
          "You do not have permission to retry this resume",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }
      // SAFETY: status/retry fields are validated enum/number columns; casts bridge Drizzle type to lifecycle row.
      const statusRow = {
        status: resume.status as ResumeStatus,
        createdAt: resume.createdAt as string | null,
        retryCount: resume.retryCount as number,
        totalAttempts: resume.totalAttempts as number,
        lastAttemptError: resume.lastAttemptError as string | null,
      };
      const eligibility = checkRetryEligibilityForRow(statusRow);
      const isVirtualTimeout = getStatusView(statusRow).isTimedOut;
      if (!eligibility.eligible) {
        // SAFETY: eligibility.errorCode is validated against ERROR_CODES keys; cast narrows string to known enum key.
        return createErrorResponse(
          eligibility.reason,
          ERROR_CODES[eligibility.errorCode as keyof typeof ERROR_CODES],
          eligibility.httpStatus,
          eligibility.details,
        );
      }

      let fileHash: string;

      if (resume.fileHash) {
        fileHash = resume.fileHash;
      } else {
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
        // SAFETY: pdfBuffer is Uint8Array from R2; slice produces ArrayBuffer for sha256Hex.
        const bufferCopy = pdfBuffer.buffer.slice(
          pdfBuffer.byteOffset,
          pdfBuffer.byteOffset + pdfBuffer.byteLength,
        ) as ArrayBuffer;
        fileHash = await sha256Hex(bufferCopy);
      }
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
            statusGuard,
            lt(resumes.retryCount, RETRY_LIMITS.MANUAL_MAX_RETRIES),
          ),
        )
        .returning({ id: resumes.id });

      if (updateResult.length === 0) {
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
          // retries the original status was already `failed`, so this is a no-op
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
      captureServerEvent(userId, "resume_parse_retried", {
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
