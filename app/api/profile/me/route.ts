import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
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
    // 1. Get D1 database binding
    const { env } = await getCloudflareContext({ async: true });
    const { db } = await getSessionDb(env.DB);

    // 2. Check authentication via Better Auth
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to access your profile",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = session.user.id;

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
    let privacySettings = {
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
    };
    if (profile.privacySettings) {
      try {
        privacySettings =
          typeof profile.privacySettings === "string"
            ? JSON.parse(profile.privacySettings)
            : profile.privacySettings;
      } catch {
        console.error("Failed to parse privacy settings");
      }
    }

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
