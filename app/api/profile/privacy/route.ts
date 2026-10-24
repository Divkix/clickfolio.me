import { Effect } from "effect";
import { decodeJsonBody, decodeWith, runRoute } from "@/lib/api/route";
import { withUser } from "@/lib/auth/with-auth";
import { updatePrivacySettings } from "@/lib/data/privacy-settings";
import { privacySettingsSchema, rowVersionSchema } from "@/lib/schemas/profile";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

export async function PUT(request: Request) {
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
    ({ user: authUser, db, dbUser }) =>
      runRoute(
        request,
        Effect.gen(function* () {
          const settings = yield* decodeJsonBody(request, privacySettingsSchema, {
            message: "Invalid privacy settings data",
          });

          // Version the client loaded; absent (or empty) means a legacy client, which keeps the unguarded write.
          const header = request.headers.get("If-Unmodified-Since");

          const expectedUpdatedAt = header
            ? yield* decodeWith(rowVersionSchema, header, {
                message: "Invalid If-Unmodified-Since header",
              })
            : null;

          const now = new Date().toISOString();

          const updated = yield* Effect.promise(() =>
            updatePrivacySettings(db, { userId: authUser.id, settings, expectedUpdatedAt, now }),
          );

          if (expectedUpdatedAt !== null && !updated) {
            return createErrorResponse(
              "Settings changed elsewhere, reload",
              ERROR_CODES.CONFLICT,
              409,
            );
          }

          revalidatePublicProfilePages([dbUser.handle]);
          notifyIndexNowForProfiles([dbUser.handle]);

          return createSuccessResponse({
            success: true,
            updated_at: now,
            privacy_settings: settings,
          });
        }),
      ),
    "You must be logged in to update privacy settings",
  );
}
