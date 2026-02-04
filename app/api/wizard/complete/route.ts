import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { siteData, user } from "@/lib/db/schema";
import { handleSchema } from "@/lib/schemas/profile";
import {
  DEFAULT_THEME,
  getThemeReferralRequirement,
  isThemeUnlocked,
  THEME_IDS,
  type ThemeId,
} from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

/**
 * Wizard completion request schema
 * Validates handle, privacy settings, and theme selection
 */
const wizardCompleteSchema = z.object({
  handle: handleSchema,
  privacy_settings: z.object({
    show_phone: z.boolean(),
    show_address: z.boolean(),
    hide_from_search: z.boolean().optional().default(false),
    show_in_directory: z.boolean().optional().default(false),
  }),
  theme_id: z.enum([...THEME_IDS] as [ThemeId, ...ThemeId[]]),
});

type WizardCompleteRequest = z.infer<typeof wizardCompleteSchema>;

/**
 * POST /api/wizard/complete
 * Completes the onboarding wizard by setting handle, privacy, and theme
 *
 * Request body:
 * {
 *   handle: string,
 *   privacy_settings: { show_phone: boolean, show_address: boolean },
 *   theme_id: ThemeId (any registered theme from theme-registry)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   handle: string
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. Validate request size before parsing (prevent DoS)
    const sizeCheck = validateRequestSize(request);
    if (!sizeCheck.valid) {
      return createErrorResponse(
        sizeCheck.error || "Request body too large",
        ERROR_CODES.BAD_REQUEST,
        413,
      );
    }

    // 2. Authenticate user and validate existence in database
    const { env } = await getCloudflareContext({ async: true });
    const {
      user: authUser,
      db,
      captureBookmark,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to complete onboarding", env.DB);
    if (authError) return authError;

    // 4. Parse and validate request body
    let body: WizardCompleteRequest;
    try {
      const rawBody = await request.json();
      const validation = wizardCompleteSchema.safeParse(rawBody);

      if (!validation.success) {
        return createErrorResponse(
          "Validation failed. Please check your input.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }

      body = validation.data;
    } catch {
      return createErrorResponse("Invalid JSON in request body", ERROR_CODES.BAD_REQUEST, 400);
    }

    // 4b. Validate theme access based on referral count
    const userResult = await db
      .select({ referralCount: user.referralCount, isPro: user.isPro })
      .from(user)
      .where(eq(user.id, authUser.id));

    const referralCount = userResult[0]?.referralCount ?? 0;
    const isPro = userResult[0]?.isPro ?? false;

    if (!isThemeUnlocked(body.theme_id as ThemeId, referralCount, isPro)) {
      const required = getThemeReferralRequirement(body.theme_id as ThemeId);
      return createErrorResponse(
        `This theme requires ${required} referral${required === 1 ? "" : "s"} to unlock. You have ${referralCount}.`,
        ERROR_CODES.FORBIDDEN,
        403,
        {
          required_referrals: required,
          current_referrals: referralCount,
        },
      );
    }

    // Safety fallback: use DEFAULT_THEME if locked theme somehow got through
    const finalThemeId = isThemeUnlocked(body.theme_id as ThemeId, referralCount, isPro)
      ? body.theme_id
      : DEFAULT_THEME;

    // 5. Check if handle is available (not already taken by another user)
    const existingHandle = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.handle, body.handle), ne(user.id, authUser.id)))
      .limit(1);

    if (existingHandle.length > 0) {
      return createErrorResponse(
        "This handle is already taken. Please choose another.",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { field: "handle", message: "Handle already taken" },
      );
    }

    // 6. Update user table with handle, privacy settings, and mark onboarding as completed
    // Wrapped in try-catch to handle race condition on unique constraint
    const privacySettings = JSON.stringify(body.privacy_settings);

    try {
      await db
        .update(user)
        .set({
          handle: body.handle,
          privacySettings,
          onboardingCompleted: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(user.id, authUser.id));
    } catch (error) {
      // Check if it's a unique constraint violation (race condition)
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return createErrorResponse(
          "This handle was just taken. Please choose a different one.",
          ERROR_CODES.CONFLICT,
          409,
        );
      }
      throw error; // Re-throw other errors
    }

    // 7. Upsert site_data with theme_id
    // Handle race condition where webhook may insert siteData between our SELECT and INSERT
    const existingSiteData = await db
      .select({ id: siteData.id })
      .from(siteData)
      .where(eq(siteData.userId, authUser.id))
      .limit(1);

    if (existingSiteData.length > 0) {
      await db
        .update(siteData)
        .set({
          themeId: finalThemeId,
          lastPublishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(siteData.userId, authUser.id));
    } else {
      // No existing siteData - try to insert, but handle race condition
      // where webhook may insert between our SELECT and INSERT
      try {
        await db.insert(siteData).values({
          id: crypto.randomUUID(),
          userId: authUser.id,
          content: "{}", // Will be populated by webhook when parsing completes
          themeId: finalThemeId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Race condition: webhook inserted first, just update the theme instead
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
          await db
            .update(siteData)
            .set({
              themeId: finalThemeId,
              lastPublishedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(siteData.userId, authUser.id));
        } else {
          throw error;
        }
      }
    }

    // 8. Capture bookmark before returning success
    await captureBookmark();

    // 9. Return success response
    return createSuccessResponse({
      success: true,
      handle: body.handle,
    });
  } catch (error) {
    console.error("Unexpected error in wizard completion:", error);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
