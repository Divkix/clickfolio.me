import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";

import { user } from "@/lib/db/schema";
import { privacySettingsSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * PUT /api/profile/privacy
 * Update user's privacy settings.
 *
 * Request body fields:
 *   - show_phone: boolean
 *   - show_address: boolean
 *   - hide_from_search: boolean
 *   - show_in_directory: boolean
 *
 * Error codes:
 *   - 400: invalid JSON or validation failure
 *   - 500: unexpected error
 */
export async function PUT(request: Request) {
  return withUser(
    request,
    async ({ user: authUser, db, captureBookmark }) => {
      // Parse and validate request body
      let body;
      try {
        body = await request.json();
      } catch {
        return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
      }

      const validation = privacySettingsSchema.safeParse(body);

      if (!validation.success) {
        return createErrorResponse(
          "Invalid privacy settings data",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }

      const { show_phone, show_address, hide_from_search, show_in_directory } = validation.data;

      // Update privacy_settings (stored as JSON string in D1)
      const privacySettings = JSON.stringify({
        show_phone,
        show_address,
        hide_from_search,
        show_in_directory,
      });

      await db
        .update(user)
        .set({
          privacySettings,
          showInDirectory: show_in_directory,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(user.id, authUser.id));

      await captureBookmark();
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
