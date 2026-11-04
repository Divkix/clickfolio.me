import { env } from "cloudflare:workers";
import { count, eq, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { requireAdminAuth } from "@/lib/auth/admin";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { Analytics } from "@/lib/effect/services/analytics";
import { analyticsWindow, lastNDays } from "@/lib/utils/date-axis";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

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
 * Today's and the last week's pageviews. Analytics are a nicety on this page: an upstream outage
 * is logged and the views read zero, but a failed database read still fails the page.
 */
function readViews(now: number) {
  const { startAt: todayStart } = analyticsWindow(1, "UTC", now);
  const { startAt: sevenDaysAgo } = analyticsWindow(7, "UTC", now);

  return Analytics.use((analytics) =>
    Effect.all(
      [
        analytics.getStats({ startAt: todayStart, endAt: now, timezone: "UTC" }),
        analytics.getPageviews({
          startAt: sevenDaysAgo,
          endAt: now,
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
        log("error", "[admin] Analytics API unavailable", {
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
    const now = Date.now();
    const views = yield* readViews(now);

    const statusMap = new Map<string, number>();

    for (const row of resumeStats) {
      statusMap.set(row.status || "unknown", row.count);
    }

    const analyticsMap = new Map(
      views?.pageviews.pageviews.map((p) => [p.x.slice(0, 10), p.y]) ?? [],
    );

    const dailyViews = lastNDays(7, "UTC", now).map((date) => ({
      date,
      views: analyticsMap.get(date) ?? 0,
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

export async function adminOverviewPageData() {
  await requireAdminAuth();

  return runPage(loadAdminStats(), Layer.mergeAll(Db.layer(env.HYPERDRIVE), Analytics.layer(env)));
}
