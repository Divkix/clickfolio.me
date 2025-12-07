import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { siteData } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
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
    const { db } = await getSessionDb(env.DB);

    // 2. Check authentication via Better Auth
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to access site data",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = session.user.id;

    // 3. Fetch site_data for the user
    const userSiteData = await db.query.siteData.findFirst({
      where: eq(siteData.userId, userId),
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
