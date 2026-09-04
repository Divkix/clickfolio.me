import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { user } from "@/lib/db/schema";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function GET(request?: Request) {
  return withUser(
    request,
    async ({ user: authUser, db }) => {
      const userId = authUser.id;

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

      const privacySettings = normalizePrivacySettings(profile.privacySettings);

      return createSuccessResponse({
        ...profile,
        privacySettings,
      });
    },
    "You must be logged in to access your profile",
  );
}
