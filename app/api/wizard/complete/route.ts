import { eq } from "drizzle-orm";
import type { z } from "zod";
import { withUser } from "@/lib/auth/with-auth";

import { siteData, user } from "@/lib/db/schema";
import { isHandleTaken } from "@/lib/rate-limit/handle-validation";
import { buildWizardCompleteSchema } from "@/lib/schemas/profile";
import { verifyThemeUnlocked } from "@/lib/templates/theme-access";
import { THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

/**
 * Wizard completion request schema
 * Validates handle, privacy settings, and theme selection
 */
const wizardCompleteSchema = buildWizardCompleteSchema([...THEME_IDS] as [ThemeId, ...ThemeId[]]);

type WizardCompleteRequest = z.infer<typeof wizardCompleteSchema>;

/**
 * POST /api/wizard/complete
 * Completes the onboarding wizard by setting handle, privacy, and theme.
 *
 * Request body:
 *   {
 *     handle: string,
 *     privacy_settings: {
 *       show_phone: boolean,
 *       show_address: boolean,
 *       hide_from_search: boolean (optional, default false),
 *       show_in_directory: boolean (optional, default true)
 *     },
 *     theme_id: ThemeId (any registered theme from theme-registry)
 *   }
 *
 * Theme access is validated via verifyThemeUnlocked (premium themes may require referrals).
 *
 * Response:
 *   { success: true, handle: string }
 *
 * Error codes:
 *   - 400: invalid JSON, validation failure, or handle already taken
 *   - 409: handle was just taken (race condition / unique constraint)
 *   - 413: request body too large
 *   - 500: database error or unexpected error
 */
export async function POST(request: Request) {
  // Validate request size before parsing (prevent DoS)
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
    async ({ user: authUser, db, captureBookmark }) => {
      // Parse and validate request body (size-capped read, no trust in Content-Length)
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }

      const validation = wizardCompleteSchema.safeParse(rawBodyResult.data);
      if (!validation.success) {
        return createErrorResponse(
          "Validation failed. Please check your input.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }
      const body: WizardCompleteRequest = validation.data;

      // Validate theme access based on referral count
      const themeError = await verifyThemeUnlocked(db, authUser.id, body.theme_id as ThemeId);
      if (themeError) return themeError;

      // Safety fallback: use DEFAULT_THEME if locked theme somehow got through
      const finalThemeId = body.theme_id;

      // Check if handle is available (not already taken by another user)
      const handleTaken = await isHandleTaken(db, authUser.id, body.handle);

      if (handleTaken) {
        return createErrorResponse(
          "This handle is already taken. Please choose another.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          { field: "handle", message: "Handle already taken" },
        );
      }

      // Update user + upsert siteData atomically via db.batch().
      // Wrapped in try-catch to handle race condition on unique constraint.
      const privacySettings = JSON.stringify(body.privacy_settings);
      const now = new Date().toISOString();

      try {
        await db.batch([
          db
            .update(user)
            .set({
              handle: body.handle,
              privacySettings,
              showInDirectory: body.privacy_settings.show_in_directory,
              onboardingCompleted: true,
              updatedAt: now,
            })
            .where(eq(user.id, authUser.id)),
          db
            .insert(siteData)
            .values({
              id: crypto.randomUUID(),
              userId: authUser.id,
              content: "{}", // Will be populated by queue consumer when parsing completes
              themeId: finalThemeId,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: siteData.userId,
              set: {
                themeId: finalThemeId,
                lastPublishedAt: now,
                updatedAt: now,
              },
            }),
        ]);
      } catch (error) {
        // Check if it's a unique constraint violation (race condition on handle)
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
          return createErrorResponse(
            "This handle was just taken. Please choose a different one.",
            ERROR_CODES.CONFLICT,
            409,
          );
        }
        throw error; // Re-throw other errors
      }

      // Capture bookmark before returning success
      await captureBookmark();

      // Return success response
      return createSuccessResponse({
        success: true,
        handle: body.handle,
      });
    },
    "You must be logged in to complete onboarding",
  );
}
