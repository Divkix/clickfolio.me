import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getResumeCacheTag } from "@/lib/data/resume";
import { siteData, user } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

const VALID_THEMES = ["bento", "glass", "minimalist_editorial", "neo_brutalist"] as const;

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
    .regex(/^[a-z0-9-]+$/, "Handle can only contain lowercase letters, numbers, and hyphens")
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

    // 2. Authenticate user
    const auth = await getAuth();
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to complete onboarding",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const authUser = session.user;

    // 3. Get database connection
    const { env } = await getCloudflareContext({ async: true });
    const { db, captureBookmark } = await getSessionDb(env.DB);

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
    const privacySettings = JSON.stringify(body.privacy_settings);

    await db
      .update(user)
      .set({
        handle: body.handle,
        privacySettings,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, authUser.id));

    // 7. Update site_data with theme_id
    const existingSiteData = await db
      .select({ id: siteData.id })
      .from(siteData)
      .where(eq(siteData.userId, authUser.id))
      .limit(1);

    if (existingSiteData.length > 0) {
      await db
        .update(siteData)
        .set({
          themeId: body.theme_id,
          lastPublishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(siteData.userId, authUser.id));
    } else {
      // Site data doesn't exist yet - it will be created when resume is parsed
      console.warn("Site data does not exist yet, skipping theme update");
    }

    // 8. Revalidate public page cache with new handle
    revalidateTag(getResumeCacheTag(body.handle));
    revalidatePath(`/${body.handle}`);

    // 9. Capture bookmark before returning success
    await captureBookmark();

    // 10. Return success response
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
