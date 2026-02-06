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
    // 1. Authenticate and validate user exists in database
    // env/db are fetched internally by requireAuthWithUserValidation
    const { user, db, error } = await requireAuthWithUserValidation(
      "You must be logged in to access site data",
    );
    if (error) return error;

    // 2. Fetch site_data for the user (explicit columns to prevent future column creep)
    const rows = await db
      .select({
        id: siteData.id,
        userId: siteData.userId,
        resumeId: siteData.resumeId,
        content: siteData.content,
        themeId: siteData.themeId,
        lastPublishedAt: siteData.lastPublishedAt,
        createdAt: siteData.createdAt,
        updatedAt: siteData.updatedAt,
      })
      .from(siteData)
      .where(eq(siteData.userId, user.id))
      .limit(1);
    const userSiteData = rows[0] ?? null;

    if (!userSiteData) {
      return createSuccessResponse(null);
    }

    // 3. Parse JSON content
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
