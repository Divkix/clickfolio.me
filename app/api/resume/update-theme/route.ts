import { revalidatePath } from "next/cache";
import { requireAuthWithMessage } from "@/lib/auth/middleware";
import { createClient } from "@/lib/supabase/server";
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

export async function POST(request: Request) {
  try {
    // Check authentication
    const authResult = await requireAuthWithMessage("You must be logged in to update theme");
    if (authResult.error) return authResult.error;
    const { user } = authResult;

    const supabase = await createClient();

    // Parse request body
    const body = await request.json();
    const { theme_id } = body;

    // Validate theme_id
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

    // Update site_data theme_id
    const { data, error: updateError } = await supabase
      .from("site_data")
      .update({
        theme_id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select("theme_id")
      .single();

    if (updateError) {
      console.error("Failed to update theme:", updateError);

      // Check if site_data doesn't exist yet
      if (updateError.code === "PGRST116") {
        return createErrorResponse(
          "Resume data not found. Please upload a resume first.",
          ERROR_CODES.NOT_FOUND,
          404,
        );
      }

      return createErrorResponse(
        "Failed to update theme. Please try again.",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    // Invalidate cache for public resume page
    // Fetch user's handle to revalidate their public page
    const { data: profile } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .single();

    if (profile?.handle) {
      // Revalidate the public resume page immediately
      // Next visitor will see updated theme
      revalidatePath(`/${profile.handle}`);
    }

    return createSuccessResponse({
      success: true,
      theme_id: data.theme_id,
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
