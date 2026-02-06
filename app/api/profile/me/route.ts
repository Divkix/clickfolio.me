import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { requireAuthWithMessage } from "@/lib/auth/middleware";
import { user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
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
    // 1. Check authentication via requireAuthWithMessage (read-only route)
    const { user: authUser, error: authError } = await requireAuthWithMessage(
      "You must be logged in to access your profile",
    );
    if (authError) return authError;

    // 2. Get D1 database binding
    const { env } = await getCloudflareContext({ async: true });
    const { db } = await getSessionDb(env.DB);

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
