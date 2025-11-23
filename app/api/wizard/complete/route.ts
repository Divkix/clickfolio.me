import { createClient } from "@/lib/supabase/server";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const VALID_THEMES = [
  "bento",
  "glass",
  "minimalist_editorial",
  "neo_brutalist",
] as const;

/**
 * Wizard completion request schema
 * Validates handle, privacy settings, and theme selection
 */
const wizardCompleteSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Handle can only contain lowercase letters, numbers, and hyphens",
    )
    .regex(/^[^-].*[^-]$/, "Handle cannot start or end with a hyphen"),
  privacy_settings: z.object({
    show_phone: z.boolean(),
    show_address: z.boolean(),
  }),
  theme_id: z.enum(VALID_THEMES),
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
 *   theme_id: 'bento' | 'glass' | 'minimalist_editorial' | 'neo_brutalist'
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

    const supabase = await createClient();

    // 2. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse(
        "You must be logged in to complete onboarding",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    // 3. Parse and validate request body
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
      return createErrorResponse(
        "Invalid JSON in request body",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // 4. Check if handle is available (not already taken)
    const { data: existingHandle, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", body.handle)
      .maybeSingle();

    if (checkError) {
      console.error("Handle check error:", checkError);
      return createErrorResponse(
        "Failed to check handle availability. Please try again.",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    if (existingHandle && existingHandle.id !== user.id) {
      return createErrorResponse(
        "This handle is already taken. Please choose another.",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { field: "handle", message: "Handle already taken" },
      );
    }

    // 5. Update profiles table with handle, privacy settings, and mark onboarding as completed
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        handle: body.handle,
        privacy_settings: body.privacy_settings,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      return createErrorResponse(
        "Failed to update profile. Please try again.",
        ERROR_CODES.DATABASE_ERROR,
        500,
      );
    }

    // 6. Update site_data with theme_id
    const { error: siteDataError } = await supabase
      .from("site_data")
      .update({
        theme_id: body.theme_id,
        last_published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (siteDataError) {
      console.error("Site data update error:", siteDataError);
      // Don't fail if site_data doesn't exist yet - it will be created when resume is parsed
      // Just log the error and continue
      console.warn("Site data update failed, but continuing wizard completion");
    }

    // 7. Revalidate public page cache with new handle
    revalidatePath(`/${body.handle}`);

    // 8. Return success response
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
