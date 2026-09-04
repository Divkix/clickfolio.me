import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { siteData } from "@/lib/db/schema";
import { createSuccessResponse } from "@/lib/utils/security-headers";
export async function GET(request?: Request) {
  return withUser(
    request,
    async ({ user, db }) => {
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

      const content = userSiteData.content ?? null;

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
