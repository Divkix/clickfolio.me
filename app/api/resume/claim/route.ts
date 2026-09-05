import { z } from "zod";
import { captureServerEvent } from "@/lib/analytics/server";
import { withUser } from "@/lib/auth/with-auth";
import { runClaimIntake } from "@/lib/resume/claim-intake";
import { getR2Binding } from "@/lib/r2";
import { claimRequestSchema } from "@/lib/schemas/resume";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { COOKIE_NAME, parseSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
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

  return withUser(
    request,
    async ({ user: authUser, db, env }) => {
      const userId = authUser.id;

      const r2Binding = getR2Binding(env);
      if (!r2Binding) {
        return createErrorResponse(
          "Storage service unavailable",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
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

      const bodyResult = claimRequestSchema.safeParse(rawBodyResult.data);
      if (!bodyResult.success) {
        return createErrorResponse(
          "Invalid upload key. Must be a temporary upload.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }
      const body = bodyResult.data;
      const { key } = body;

      // SECURITY: Prevents unauthorized claims of leaked temp keys (Issue #89)
      const cookieHeader = request.headers.get("cookie");
      const pendingUploadCookie = cookieHeader
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${COOKIE_NAME}=`))
        ?.slice(`${COOKIE_NAME}=`.length);

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

      const parsedCookie = await parseSignedCookieValue(pendingUploadCookie, cookieSecret);
      if (!parsedCookie) {
        return createErrorResponse(
          "Unauthorized upload attempt. Invalid or expired upload verification.",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }

      if (parsedCookie.tempKey !== key) {
        return createErrorResponse(
          "Unauthorized upload attempt. Upload key mismatch.",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }

      const outcome = await runClaimIntake({
        db,
        r2: r2Binding,
        queue: env.CLICKFOLIO_PARSE_QUEUE,
        env,
        userId,
        tempKey: key,
      });

      switch (outcome.kind) {
        case "already_claimed":
          return createSuccessResponse({
            resume_id: outcome.resumeId,
            status: outcome.status,
            already_claimed: true,
          });
        case "cached":
          captureServerEvent(userId, "resume_claim_cached", {
            resume_id: outcome.resumeId,
          });
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
          captureServerEvent(userId, "resume_claimed", {
            resume_id: outcome.resumeId,
          });
          return createSuccessResponse({
            resume_id: outcome.resumeId,
            status: "queued",
          });
        case "rate_limited":
          return outcome.response;
        case "error":
          return createErrorResponse(
            outcome.message,
            ERROR_CODES[outcome.code],
            outcome.httpStatus,
          );
      }
    },
    "You must be logged in to claim a resume",
  );
}
