import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { siteData } from "@/lib/db/schema";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * GET /api/site-data
 * Fetch site_data for the currently authenticated user
 */
export async function GET() {
  try {
    // 1. Get D1 database binding
    const { env } = await getCloudflareContext({ async: true });

    // 2. Authenticate and validate user exists in database
    // Uses the standard helper that protects against stale sessions
    const { user, db, error } = await requireAuthWithUserValidation(
      "You must be logged in to access site data",
      env.DB,
    );
    if (error) return error;

    // 3. Fetch site_data for the user
    const userSiteData = await db.query.siteData.findFirst({
      where: eq(siteData.userId, user.id),
    });

    if (!userSiteData) {
      return createSuccessResponse(null);
    }

    // 4. Parse JSON content
    let content = null;
    if (userSiteData.content) {
      try {
        content =
          typeof userSiteData.content === "string"
            ? JSON.parse(userSiteData.content)
            : userSiteData.content;
      } catch {
        console.error("Failed to parse site_data content");
      }
    }

    return createSuccessResponse({
      id: userSiteData.id,
      userId: userSiteData.userId,
      resumeId: userSiteData.resumeId,
      content,
      themeId: userSiteData.themeId,
      lastPublishedAt: userSiteData.lastPublishedAt,
      createdAt: userSiteData.createdAt,
      updatedAt: userSiteData.updatedAt,
    });
  } catch (err) {
    console.error("Error fetching site data:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
