import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { siteData } from "@/lib/db/schema";
import { createSuccessResponse } from "@/lib/utils/security-headers";

/**
 * GET /api/site-data
 * Fetch site_data for the currently authenticated user.
 *
 * Requires authentication. Returns `null` if no site data exists for the user.
 * The `content` field is parsed from a JSON string before being returned.
 *
 * Error codes: 500 on unexpected errors.
 */
export async function GET(request?: Request) {
  return withUser(
    request,
    async ({ user, db }) => {
      // Fetch site_data for the user (explicit columns to prevent future column creep)
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

      // Parse JSON content
      let content = null;
      if (userSiteData.content) {
        try {
          content =
            typeof userSiteData.content === "string"
              ? JSON.parse(userSiteData.content)
              : userSiteData.content;
        } catch (error) {
          console.error("Failed to parse site_data content", error);
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
    },
    "You must be logged in to access site data",
  );
}
