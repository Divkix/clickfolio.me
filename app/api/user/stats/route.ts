import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
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
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const userData = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
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
