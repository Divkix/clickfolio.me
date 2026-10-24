import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { z } from "zod";
import { withUserEffect } from "@/lib/auth/with-auth";
import { InvalidInput } from "@/lib/effect/failures";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2Store } from "@/lib/effect/services/r2-store";
import { WorkflowStarter } from "@/lib/effect/services/workflow-starter";
import { runClaimIntake } from "@/lib/resume/claim-intake";
import { claimRequestSchema } from "@/lib/schemas/resume";
import { errorFields } from "@/lib/utils/error-fields";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { logEvent } from "@/lib/utils/log";
import {
  COOKIE_NAME,
  decodePendingUploadCookie,
  parseSignedCookieValue,
} from "@/lib/utils/pending-upload-cookie";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

export async function POST(request: Request) {
  const sizeCheck = validateRequestSize(request);

  if (!sizeCheck.valid) {
    return createErrorResponse(
      sizeCheck.error || "Request body too large",
      ERROR_CODES.BAD_REQUEST,
      413,
    );
  }

  return withUserEffect(
    request,
    ({ user: authUser }) =>
      Effect.gen(function* () {
        const userId = authUser.id;

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

        const bodyResult = claimRequestSchema.safeParse(rawBodyResult.data);

        if (!bodyResult.success) {
          return createErrorResponse(
            "Invalid upload key. Must be a temporary upload.",
            ERROR_CODES.VALIDATION_ERROR,
            400,
          );
        }

        const { key } = bodyResult.data;

        // SECURITY: Prevents unauthorized claims of leaked temp keys (Issue #89)
        const cookieHeader = request.headers.get("cookie");

        const rawPendingUploadCookie = cookieHeader
          ?.split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith(`${COOKIE_NAME}=`))
          ?.slice(`${COOKIE_NAME}=`.length);

        // A value that is not valid percent-encoding stays raw and fails the signature check.
        const pendingUploadCookie =
          rawPendingUploadCookie &&
          (decodePendingUploadCookie(rawPendingUploadCookie) ?? rawPendingUploadCookie);

        if (!pendingUploadCookie) {
          return createErrorResponse(
            "Unauthorized upload attempt. Upload verification cookie is missing.",
            ERROR_CODES.FORBIDDEN,
            403,
          );
        }

        const cookieSecret = getOptionalEnvValue(env, "PENDING_UPLOAD_SECRET");

        if (!cookieSecret || !z.string().safeParse(cookieSecret).success) {
          return createErrorResponse(
            "Upload verification unavailable. Server configuration error.",
            ERROR_CODES.INTERNAL_ERROR,
            500,
          );
        }

        const parsedCookie = yield* Effect.promise(() =>
          parseSignedCookieValue(pendingUploadCookie, cookieSecret),
        );

        if (!parsedCookie) {
          return createErrorResponse(
            "Unauthorized upload attempt. Invalid or expired upload verification.",
            ERROR_CODES.FORBIDDEN,
            403,
          );
        }

        if (parsedCookie.tempKey !== key) {
          // Never clear the cookie on mismatch: it may belong to a newer upload than
          // the key in this request, and clearing it would orphan that upload.
          return createErrorResponse(
            `Unauthorized upload attempt. Upload key mismatch (expected ${parsedCookie.tempKey}, received ${key}).`,
            ERROR_CODES.FORBIDDEN,
            403,
          );
        }

        const outcome = yield* runClaimIntake({ userId, tempKey: key });

        switch (outcome.kind) {
          case "already_claimed":
            return createSuccessResponse({
              resume_id: outcome.resumeId,
              status: outcome.status,
              already_claimed: true,
            });
          case "cached":
            logEvent("resume_claim_cached", { userId, resumeId: outcome.resumeId });

            return createSuccessResponse({
              resume_id: outcome.resumeId,
              status: "completed",
              cached: true,
            });
          case "waiting_for_cache":
            return createSuccessResponse({
              resume_id: outcome.resumeId,
              status: "processing",
              waiting_for_cache: true,
            });
          case "queued":
            logEvent("resume_claimed", { userId, resumeId: outcome.resumeId });

            return createSuccessResponse({
              resume_id: outcome.resumeId,
              status: "queued",
            });
          case "error":
            return createErrorResponse(
              outcome.message,
              ERROR_CODES[outcome.code],
              outcome.httpStatus,
            );
        }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            R2Store.layer(env),
            R2DeleteScheduler.layer(env),
            WorkflowStarter.layer(env),
          ),
        ),
      ),
    "You must be logged in to claim a resume",
  );
}
