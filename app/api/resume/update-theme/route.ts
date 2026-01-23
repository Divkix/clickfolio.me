import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { getResumeCacheTag } from "@/lib/data/resume";
import { siteData } from "@/lib/db/schema";
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
    // 1. Authenticate user and validate existence in database
    const { env } = await getCloudflareContext({ async: true });
    const {
      user: authUser,
      db,
      captureBookmark,
      dbUser,
      error: authError,
    } = await requireAuthWithUserValidation("You must be logged in to update theme", env.DB);
    if (authError) return authError;

    const userId = authUser.id;
    const userHandle = dbUser.handle;

    // 4. Parse request body
    const body = (await request.json()) as ThemeUpdateRequestBody;
    const { theme_id } = body;

    // 5. Validate theme_id
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

    // 6. Update site_data theme_id
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

    // 7. Invalidate cache for public resume page
    if (userHandle) {
      revalidateTag(getResumeCacheTag(userHandle), "max");
      revalidatePath(`/${userHandle}`);
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
