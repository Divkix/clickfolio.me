/**
 * GET /api/admin/users?page=1&search=query
 *
 * Returns paginated user list with search.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { count, like, or, sql } from "drizzle-orm";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { pageViews, resumes, siteData, user } from "@/lib/db/schema";

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  const { error } = await requireAdminAuthForApi();
  if (error) return error;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
  const search = url.searchParams.get("search")?.trim() || "";
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Build where clause for search
    const searchCondition = search
      ? or(
          like(user.name, `%${search}%`),
          like(user.email, `%${search}%`),
          like(user.handle, `%${search}%`),
        )
      : undefined;

    // Get total count
    const [totalResult] = await db.select({ count: count() }).from(user).where(searchCondition);

    // Get users with resume status and view counts
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        handle: user.handle,
        createdAt: user.createdAt,
        isPro: user.isPro,
      })
      .from(user)
      .where(searchCondition)
      .orderBy(sql`${user.createdAt} DESC`)
      .limit(PAGE_SIZE)
      .offset(offset);

    // Get resume statuses and view counts for these users
    const userIds = users.map((u) => u.id);

    if (userIds.length === 0) {
      return Response.json({
        users: [],
        total: 0,
        page,
        pageSize: PAGE_SIZE,
      });
    }

    const [resumeStatuses, viewCounts, hasSiteData] = await Promise.all([
      db
        .select({
          userId: resumes.userId,
          status: resumes.status,
        })
        .from(resumes)
        .where(
          sql`${resumes.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),

      db
        .select({
          userId: pageViews.userId,
          views: count(),
        })
        .from(pageViews)
        .where(
          sql`${pageViews.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(pageViews.userId),

      db
        .select({ userId: siteData.userId })
        .from(siteData)
        .where(
          sql`${siteData.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
    ]);

    // Build lookup maps
    const resumeStatusMap = new Map<string, string>();
    for (const r of resumeStatuses) {
      // Prefer showing worst status (failed > processing > completed)
      const existing = resumeStatusMap.get(r.userId);
      if (
        !existing ||
        r.status === "failed" ||
        (r.status === "processing" && existing !== "failed")
      ) {
        resumeStatusMap.set(r.userId, r.status || "unknown");
      }
    }

    const viewCountMap = new Map(viewCounts.map((v) => [v.userId, v.views]));
    const siteDataSet = new Set(hasSiteData.map((s) => s.userId));

    // Determine user status
    const enrichedUsers = users.map((u) => {
      let status: "live" | "processing" | "no_resume" | "failed" = "no_resume";
      const resumeStatus = resumeStatusMap.get(u.id);

      if (resumeStatus === "failed") {
        status = "failed";
      } else if (resumeStatus === "processing" || resumeStatus === "queued") {
        status = "processing";
      } else if (siteDataSet.has(u.id)) {
        status = "live";
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        handle: u.handle,
        status,
        views: viewCountMap.get(u.id) ?? 0,
        createdAt: u.createdAt,
        isPro: u.isPro,
      };
    });

    return Response.json({
      users: enrichedUsers,
      total: totalResult?.count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    console.error("[admin/users] Error:", err);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
