import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { user } from "@/lib/db/schema";
import { parsePrivacySettings } from "@/lib/utils/privacy";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/profile/me
 * Fetch the current user's profile
 */
export async function GET() {
  try {
    // 1. Check authentication and validate user exists in database
    const {
      user: authUser,
      db,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to access your profile");
    if (authError) return authError;

    // 2. Use the db from auth validation (already connected with primary-first consistency)
    const userId = authUser.id;

    // 3. Fetch user from database
    const userRecord = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        handle: user.handle,
        headline: user.headline,
        privacySettings: user.privacySettings,
        onboardingCompleted: user.onboardingCompleted,
        role: user.role,
        roleSource: user.roleSource,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord.length) {
      return createErrorResponse("User not found", ERROR_CODES.NOT_FOUND, 404);
    }

    const profile = userRecord[0];

    // 4. Parse privacy settings JSON
    const privacySettings = parsePrivacySettings(profile.privacySettings);

    return createSuccessResponse({
      ...profile,
      privacySettings,
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
