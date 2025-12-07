import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getResumeCacheTag } from "@/lib/data/resume";
import { siteData, user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { TEMPLATES, type ThemeId } from "@/lib/templates/theme-registry";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

// Get valid themes from the source of truth
const VALID_THEMES = Object.keys(TEMPLATES) as ThemeId[];

function isValidTheme(theme: string): theme is ThemeId {
  return VALID_THEMES.includes(theme as ThemeId);
}

interface ThemeUpdateRequestBody {
  theme_id?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Get D1 database binding
    const { env } = await getCloudflareContext({ async: true });
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 2. Check authentication via Better Auth
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to update theme",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = session.user.id;

    // 3. Parse request body
    const body = (await request.json()) as ThemeUpdateRequestBody;
    const { theme_id } = body;

    // 4. Validate theme_id
    if (!theme_id || typeof theme_id !== "string") {
      return createErrorResponse(
        "theme_id is required and must be a string",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    if (!isValidTheme(theme_id)) {
      return createErrorResponse("Invalid theme_id provided", ERROR_CODES.VALIDATION_ERROR, 400, {
        valid_themes: VALID_THEMES,
      });
    }

    const now = new Date().toISOString();

    // 5. Update site_data theme_id
    const updateResult = await db
      .update(siteData)
      .set({
        themeId: theme_id,
        updatedAt: now,
      })
      .where(eq(siteData.userId, userId))
      .returning({ themeId: siteData.themeId });

    if (updateResult.length === 0) {
      // No rows updated - site_data doesn't exist yet
      return createErrorResponse(
        "Resume data not found. Please upload a resume first.",
        ERROR_CODES.NOT_FOUND,
        404,
      );
    }

    const data = updateResult[0];

    // 6. Invalidate cache for public resume page
    // Fetch user's handle to revalidate their public page
    const profile = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { handle: true },
    });

    if (profile?.handle) {
      // Revalidate the public resume page immediately
      // Tag invalidation works with unstable_cache, path works with full route cache
      revalidateTag(getResumeCacheTag(profile.handle));
      revalidatePath(`/${profile.handle}`);
    }

    await captureBookmark();

    return createSuccessResponse({
      success: true,
      theme_id: data.themeId,
      message: "Theme updated successfully",
    });
  } catch (error) {
    console.error("Theme update error:", error);
    return createErrorResponse(
      "An unexpected error occurred while updating theme",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
