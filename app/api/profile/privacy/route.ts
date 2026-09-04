import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";

import { user } from "@/lib/db/schema";
import { privacySettingsSchema } from "@/lib/schemas/profile";
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
    async ({ user: authUser, db }) => {
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

      await db
        .update(user)
        .set({
          privacySettings,
          showInDirectory: show_in_directory,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(user.id, authUser.id));

      return createSuccessResponse({
        success: true,
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
