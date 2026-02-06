import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { requireAuthWithMessage } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";

/**
 * GET /api/user/stats
 *
 * Returns the current user's stats including referral count and pro status.
 * Used by the wizard and other client components that need this data.
 */
export async function GET() {
  try {
    // Check authentication via requireAuthWithMessage (read-only route)
    const { user: authUser, error: authError } = await requireAuthWithMessage(
      "You must be logged in to view stats",
    );
    if (authError) return authError;

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const userData = await db.query.user.findFirst({
      where: eq(user.id, authUser.id),
      columns: {
        referralCount: true,
        isPro: true,
      },
    });

    if (!userData) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({
      referralCount: userData.referralCount ?? 0,
      isPro: userData.isPro ?? false,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
