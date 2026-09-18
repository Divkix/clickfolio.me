import { and, eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";

import { user } from "@/lib/db/schema";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

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
    async ({ user: authUser, db, dbUser }) => {
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }

      const validation = privacySettingsSchema.safeParse(rawBodyResult.data);

      if (!validation.success) {
        return createErrorResponse(
          "Invalid privacy settings data",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }

      const { show_phone, show_address, hide_from_search, show_in_directory } = validation.data;

      const privacySettings = {
        show_phone,
        show_address,
        hide_from_search,
        show_in_directory,
      };

      // Version the client loaded; absent means a legacy client, which keeps the unguarded write.
      const expectedUpdatedAt = request.headers.get("If-Unmodified-Since");

      const now = new Date().toISOString();

      const updated = await db
        .update(user)
        .set({
          privacySettings,
          showInDirectory: show_in_directory,
          updatedAt: now,
        })
        .where(
          expectedUpdatedAt
            ? and(eq(user.id, authUser.id), eq(user.updatedAt, expectedUpdatedAt))
            : eq(user.id, authUser.id),
        )
        .returning({ id: user.id });

      if (expectedUpdatedAt && updated.length === 0) {
        return createErrorResponse("Settings changed elsewhere, reload", ERROR_CODES.CONFLICT, 409);
      }

      revalidatePublicProfilePages([dbUser.handle]);

      return createSuccessResponse({
        success: true,
        updated_at: now,
        privacy_settings: {
          show_phone,
          show_address,
          hide_from_search,
          show_in_directory,
        },
      });
    },
    "You must be logged in to update privacy settings",
  );
}
