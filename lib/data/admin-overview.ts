import { count, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Umami } from "@/lib/effect/services/umami";
import { lastNUtcDays } from "@/lib/utils/date-axis";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The four counts behind the admin overview, read together under one database timeout. */
function readCounts() {
  return Db.use((service) =>
    service.query("admin.overview", (db) =>
      Promise.all([
        db.select({ count: count() }).from(user),
        db.select({ count: count() }).from(siteData),
        db.select({ status: resumes.status, count: count() }).from(resumes).groupBy(resumes.status),
        db
          .select({
            email: user.email,
            name: user.name,
            previewName: siteData.previewName,
            createdAt: user.createdAt,
          })
          .from(user)
          .leftJoin(siteData, eq(user.id, siteData.userId))
          .orderBy(sql`${user.createdAt} DESC`)
          .limit(10),
      ]),
    ),
  );
}

/**
 * Today's and the last week's pageviews. Analytics are a nicety on this page: Umami being down
 * is logged and the views read zero, but a failed database read still fails the page.
 */
function readViews(now: Date) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  return Umami.use((umami) =>
    Effect.all(
      [
        umami.getStats({ startAt: todayStart.getTime(), endAt: now.getTime() }),
        umami.getPageviews({
          startAt: sevenDaysAgo.getTime(),
          endAt: now.getTime(),
          unit: "day",
          timezone: "UTC",
        }),
      ],
      { concurrency: 2 },
    ),
  ).pipe(
    Effect.map(([stats, pageviews]) => ({ stats, pageviews })),
    Effect.catchTag("HttpUpstreamFailed", (failure) =>
      Effect.sync(() => {
        log("error", "[admin] Umami API unavailable", {
          operation: failure.operation,
          kind: failure.kind,
          ...errorFields(failure.cause),
        });

        return null;
      }),
    ),
  );
}

export function loadAdminStats() {
  return Effect.gen(function* () {
    const [userCount, siteDataCount, resumeStats, recentSignups] = yield* readCounts();
    const views = yield* Effect.sync(() => new Date()).pipe(Effect.flatMap(readViews));

    const statusMap = new Map<string, number>();

    for (const row of resumeStats) {
      statusMap.set(row.status || "unknown", row.count);
    }

    const umamiMap = new Map(views?.pageviews.pageviews.map((p) => [p.x.slice(0, 10), p.y]) ?? []);

    const dailyViews = lastNUtcDays(7).map((date) => ({
      date,
      views: umamiMap.get(date) ?? 0,
    }));

    return {
      totalUsers: userCount[0]?.count ?? 0,
      publishedResumes: siteDataCount[0]?.count ?? 0,
      processingResumes: (statusMap.get("processing") ?? 0) + (statusMap.get("queued") ?? 0),
      failedResumes: statusMap.get("failed") ?? 0,
      viewsToday: views?.stats.pageviews ?? 0,
      recentSignups,
      dailyViews,
    };
  });
}
