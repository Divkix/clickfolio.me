import { env } from "cloudflare:workers";
import { and, eq, lt, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { z } from "zod";
import { withUserEffect } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Forbidden, InvalidInput, NotFound, R2Failed } from "@/lib/effect/failures";
import { R2Store } from "@/lib/effect/services/r2-store";
import { WorkflowStarter } from "@/lib/effect/services/workflow-starter";
import { checkRetryEligibilityForRow, getStatusView, RETRY_LIMITS } from "@/lib/resume/lifecycle";
import { errorFields } from "@/lib/utils/error-fields";
import { sha256Hex } from "@/lib/utils/hash";
import { log, logEvent } from "@/lib/utils/log";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";
import { parseInstanceId } from "@/lib/workflows/resume-parse";

const retryRequestSchema = z.object({ resume_id: z.string().min(1) });

type RollbackTarget = {
  readonly resumeId: string;
  /** What the row was before this request queued it: `failed`, or `waiting_for_cache` after a virtual timeout. */
  readonly previousStatus: "failed" | "waiting_for_cache";
  readonly previousErrorMessage: string | null;
  readonly previousRetryCount: number;
};

/**
 * Puts the row back the way this request found it, so the visitor can retry again. Compare-and-set
 * on (status, retryCount): it undoes only this request's own increment, never a concurrent retry
 * that has since taken over the row. If this write fails the row stays `queued` with no workflow
 * run until the 15-minute sweep fails it (the retry route only accepts `failed`), which is why the
 * failure is logged loudly and surfaced as the route's failure instead of being hidden behind the
 * start failure.
 */
function rollbackRetry(target: RollbackTarget) {
  return Db.use((service) =>
    service.query("resume.retry.rollback", (db) =>
      db
        .update(resumes)
        .set({
          status: target.previousStatus,
          errorMessage: target.previousErrorMessage,
          retryCount: target.previousRetryCount,
          queuedAt: null,
        })
        .where(
          and(
            eq(resumes.id, target.resumeId),
            eq(resumes.status, "queued"),
            eq(resumes.retryCount, target.previousRetryCount + 1),
          ),
        ),
    ),
  ).pipe(
    Effect.tapError((failure) =>
      Effect.sync(() => {
        log("error", "Retry rollback failed; resume left queued without a workflow run", {
          resumeId: target.resumeId,
          ...errorFields(failure.cause ?? failure),
        });
      }),
    ),
  );
}

export async function POST(request: Request) {
  return withUserEffect(
    request,
    ({ user: authUser }) =>
      Effect.gen(function* () {
        const userId = authUser.id;

        const sizeCheck = validateRequestSize(request);

        if (!sizeCheck.valid) {
          return createErrorResponse(
            sizeCheck.error || "Request body too large",
            ERROR_CODES.BAD_REQUEST,
            413,
          );
        }

        const rawBodyResult = yield* Effect.tryPromise({
          try: () => readJsonWithLimit(request),
          // The client went away mid-request.
          catch: (cause) =>
            new InvalidInput({
              message: "Could not read the request body",
              details: errorFields(cause),
            }),
        });

        if (!rawBodyResult.ok) {
          return createErrorResponse(
            rawBodyResult.error,
            ERROR_CODES.BAD_REQUEST,
            rawBodyResult.reason === "too_large" ? 413 : 400,
          );
        }

        const body = retryRequestSchema.safeParse(rawBodyResult.data);

        if (!body.success) {
          return createErrorResponse(
            "resume_id is required in request body",
            ERROR_CODES.BAD_REQUEST,
            400,
          );
        }

        const resumeId = body.data.resume_id;

        const resume = yield* Db.use((service) =>
          service.query("resume.retry.read", (db) =>
            db.query.resumes.findFirst({
              where: eq(resumes.id, resumeId),
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
            }),
          ),
        );

        if (!resume) {
          return yield* Effect.fail(new NotFound({ message: "Resume not found" }));
        }

        if (resume.userId !== userId) {
          return yield* Effect.fail(
            new Forbidden({ message: "You do not have permission to retry this resume" }),
          );
        }

        const statusRow = {
          status: resume.status,
          createdAt: resume.createdAt,
          retryCount: resume.retryCount,
          totalAttempts: resume.totalAttempts,
          lastAttemptError: resume.lastAttemptError,
        };

        const eligibility = checkRetryEligibilityForRow(statusRow);
        const isVirtualTimeout = getStatusView(statusRow).isTimedOut;

        if (!eligibility.eligible) {
          return createErrorResponse(
            eligibility.reason,
            ERROR_CODES[eligibility.errorCode],
            eligibility.httpStatus,
            eligibility.details,
          );
        }

        const fileHash = yield* resume.fileHash
          ? Effect.succeed(resume.fileHash)
          : hashStoredFile(resume.r2Key);

        const previousRetryCount = resume.retryCount;
        const nextRetryCount = previousRetryCount + 1;

        // TOCTOU guard: for a virtual timeout the row is still `waiting_for_cache`
        // in the DB, so guard on that status; otherwise guard on `failed`.
        const previousStatus = isVirtualTimeout ? "waiting_for_cache" : "failed";

        // Increment in SQL, compare-and-set on the value read above: two concurrent
        // retries of the same row cannot both bump retryCount.
        const updateResult = yield* Db.use((service) =>
          service.query("resume.retry.queue", (db) =>
            db
              .update(resumes)
              .set({
                status: "queued",
                errorMessage: null,
                retryCount: sql`${resumes.retryCount} + 1`,
                queuedAt: new Date().toISOString(),
              })
              .where(
                and(
                  eq(resumes.id, resumeId),
                  eq(resumes.status, previousStatus),
                  eq(resumes.retryCount, previousRetryCount),
                  lt(resumes.retryCount, RETRY_LIMITS.MANUAL_MAX_RETRIES),
                ),
              )
              .returning({ id: resumes.id }),
          ),
        );

        if (updateResult.length === 0) {
          return createErrorResponse(
            "Resume was already retried or is no longer in a retryable state",
            ERROR_CODES.CONFLICT,
            409,
          );
        }

        // Each start gets a fresh instance id: a start that failed after Workflows persisted the
        // instance leaves that id burned while the rollback restores the row, so a retry cannot
        // reuse it. A start that fails or times out is given up on: the row goes back to its
        // previous state and the pipeline's status-guarded steps make a late-starting run a no-op.
        yield* WorkflowStarter.use((starter) =>
          starter.startResumeParse(parseInstanceId(resume.id, nextRetryCount), {
            kind: "parse",
            resumeId: resume.id,
            userId,
            r2Key: resume.r2Key,
            fileHash,
            retryCount: nextRetryCount,
          }),
        ).pipe(
          Effect.tapError(() =>
            rollbackRetry({
              resumeId,
              previousStatus,
              previousErrorMessage: resume.errorMessage,
              previousRetryCount,
            }),
          ),
        );

        logEvent("resume_parse_retried", {
          userId,
          resumeId: resume.id,
          retryCount: nextRetryCount,
        });

        return createSuccessResponse({
          resume_id: resume.id,
          status: "queued",
          retry_count: nextRetryCount,
        });
      }).pipe(Effect.provide(Layer.mergeAll(R2Store.layer(env), WorkflowStarter.layer(env)))),
    "You must be logged in to retry resume parsing",
  );
}

/** Hash of the uploaded PDF, for rows parsed before the upload recorded one. */
function hashStoredFile(r2Key: string) {
  return R2Store.use((store) => store.get(r2Key)).pipe(
    Effect.flatMap((bytes) => Effect.promise(() => sha256Hex(bytes))),
    // The row points at a file the bucket no longer has: retrying can never succeed, so this is
    // a 500, not an outage the visitor should wait out.
    Effect.catchTag("R2ObjectMissing", (missing) =>
      Effect.fail(
        new R2Failed({
          operation: "r2.get",
          kind: "rejected",
          message: missing.message,
        }),
      ),
    ),
  );
}
