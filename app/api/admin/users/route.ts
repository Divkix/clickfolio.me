import { env } from "cloudflare:workers";
import { count, or, sql } from "drizzle-orm";
import { withAdmin } from "@/lib/auth/with-auth";
import { getDb } from "@/lib/db";
import { resumes, siteData, user } from "@/lib/db/schema";
import { createSuccessResponse } from "@/lib/utils/security-headers";
import { safePageParam } from "@/lib/utils/pagination";

const PAGE_SIZE = 25;

/**
 * Escapes LIKE wildcard characters to prevent pattern injection.
 * Postgres ILIKE wildcards: % (any sequence), _ (any single char); the
 * exclamation mark is used as the escape character so no backslash quoting
 * is involved anywhere in the pattern.
 */
function escapeLikePattern(input: string): string {
  return input.replace(/[%_!]/g, (char) => `!${char}`);
}

export async function GET(request: Request) {
  return withAdmin(request, async () => {
    const url = new URL(request.url);
    const page = safePageParam(url.searchParams.get("page"));
    const search = url.searchParams.get("search")?.trim() || "";
    const offset = (page - 1) * PAGE_SIZE;

    const db = getDb(env.HYPERDRIVE);

    const escapedSearch = escapeLikePattern(search);

    // Build where clause for case-insensitive search.
    // Raw sql with ESCAPE '!' because Drizzle's ilike() omits the ESCAPE clause;
    // a literal keeps the escape char valid under every Postgres string config.
    const searchCondition = search
      ? or(
          sql`${user.name} ILIKE ${`%${escapedSearch}%`} ESCAPE '!'`,
          sql`${user.email} ILIKE ${`%${escapedSearch}%`} ESCAPE '!'`,
          sql`${user.handle} ILIKE ${`%${escapedSearch}%`} ESCAPE '!'`,
          sql`EXISTS (SELECT 1 FROM site_data WHERE site_data.user_id = ${user.id} AND site_data.preview_name ILIKE ${`%${escapedSearch}%`} ESCAPE '!')`,
        )
      : undefined;

    const [totalResult] = await db.select({ count: count() }).from(user).where(searchCondition);

    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        handle: user.handle,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(searchCondition)
      .orderBy(sql`${user.createdAt} DESC`)
      .limit(PAGE_SIZE)
      .offset(offset);

    const userIds = users.map((u) => u.id);

    if (userIds.length === 0) {
      return createSuccessResponse({
        users: [],
        total: totalResult?.count ?? 0,
        page,
        pageSize: PAGE_SIZE,
      });
    }

    const [resumeStatuses, hasSiteData] = await Promise.all([
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
          userId: siteData.userId,
          lastPublishedAt: siteData.lastPublishedAt,
          previewName: siteData.previewName,
        })
        .from(siteData)
        .where(
          sql`${siteData.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
    ]);

    const resumeStatusMap = new Map<string, string>();
    for (const r of resumeStatuses) {
      const existing = resumeStatusMap.get(r.userId);
      if (
        !existing ||
        r.status === "failed" ||
        (r.status === "processing" && existing !== "failed")
      ) {
        resumeStatusMap.set(r.userId, r.status || "unknown");
      }
    }

    const siteDataMap = new Map<
      string,
      { lastPublishedAt: string | null; previewName: string | null }
    >();
    for (const s of hasSiteData) {
      siteDataMap.set(s.userId, {
        lastPublishedAt: s.lastPublishedAt,
        previewName: s.previewName,
      });
    }

    const siteDataSet = new Set(
      hasSiteData.filter((s) => s.lastPublishedAt !== null).map((s) => s.userId),
    );

    const enrichedUsers = users.map((u) => {
      let status: "live" | "processing" | "no_resume" | "failed" = "no_resume";
      const resumeStatus = resumeStatusMap.get(u.id);
      const siteInfo = siteDataMap.get(u.id);

      if (resumeStatus === "failed") {
        status = "failed";
      } else if (resumeStatus === "processing" || resumeStatus === "queued") {
        status = "processing";
      } else if (u.handle && siteDataSet.has(u.id)) {
        status = "live";
      }

      const displayName =
        u.name && u.name !== "Unnamed"
          ? u.name
          : siteInfo?.previewName?.trim() || u.name || "Unnamed";

      return {
        id: u.id,
        name: displayName,
        email: u.email,
        handle: u.handle,
        status,
        createdAt: u.createdAt,
      };
    });

    return createSuccessResponse({
      users: enrichedUsers,
      total: totalResult?.count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    });
  });
}
