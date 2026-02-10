/**
 * GET /api/analytics/stats?period=7d|30d|90d
 *
 * Authenticated endpoint returning aggregated page view analytics
 * for the logged-in user's resume page. Proxies Umami Analytics API.
 */

import { eq } from "drizzle-orm";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { handleChanges } from "@/lib/db/schema";
import { getMetrics, getPageviews, getStats } from "@/lib/umami/client";

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);

const PERIOD_MS: Record<string, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

function periodToDays(period: string): number {
  switch (period) {
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 7;
  }
}

export async function GET(request: Request) {
  const { db, dbUser, env, error } = await requireAuthWithUserValidation(
    "Must be logged in to view analytics",
  );
  if (error) return error;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "7d";

  if (!VALID_PERIODS.has(period)) {
    return Response.json({ error: "Invalid period. Use 7d, 30d, or 90d." }, { status: 400 });
  }

  const currentHandle = dbUser.handle;
  if (!currentHandle) {
    return Response.json({
      totalViews: 0,
      uniqueVisitors: 0,
      viewsByDay: [],
      topReferrers: [],
      directVisits: 0,
      deviceBreakdown: [],
      countryBreakdown: [],
      period,
    });
  }

  try {
    const endAt = Date.now();
    const startAt = endAt - (PERIOD_MS[period] ?? PERIOD_MS["7d"]);

    // Collect all handles (current + historical) for users who changed handles
    const oldHandleRows = await db
      .select({ oldHandle: handleChanges.oldHandle })
      .from(handleChanges)
      .where(eq(handleChanges.userId, dbUser.id));

    const handleSet = new Set([currentHandle]);
    // Cap at 3 most recent old handles to bound Umami API fan-out
    for (const row of oldHandleRows.slice(0, 3)) {
      if (row.oldHandle) {
        handleSet.add(row.oldHandle);
      }
    }
    // Umami tracks profile URLs as /@handle
    const handlePaths = [...handleSet].map((h) => `/@${h}`);

    // Fan out all Umami queries for all handle paths in parallel
    const [statsResults, pageviewsResults, referrerResults, deviceResults, countryResults] =
      await Promise.all([
        Promise.all(handlePaths.map((p) => getStats(env, { startAt, endAt, path: p }))),
        Promise.all(
          handlePaths.map((p) =>
            getPageviews(env, {
              startAt,
              endAt,
              unit: "day",
              timezone: "UTC",
              path: p,
            }),
          ),
        ),
        Promise.all(
          handlePaths.map((p) =>
            getMetrics(env, {
              startAt,
              endAt,
              type: "referrer",
              unit: "day",
              timezone: "UTC",
              path: p,
            }),
          ),
        ),
        Promise.all(
          handlePaths.map((p) =>
            getMetrics(env, {
              startAt,
              endAt,
              type: "device",
              unit: "day",
              timezone: "UTC",
              path: p,
            }),
          ),
        ),
        Promise.all(
          handlePaths.map((p) =>
            getMetrics(env, {
              startAt,
              endAt,
              type: "country",
              unit: "day",
              timezone: "UTC",
              path: p,
            }),
          ),
        ),
      ]);

    // Aggregate stats across all handles
    // Note: uniqueVisitors is summed per-handle, so a visitor who saw both
    // old and new handles after a handle change may be counted twice.
    // This is an acceptable trade-off since Umami doesn't support OR URL filters.
    let totalViews = 0;
    let uniqueVisitors = 0;
    for (const s of statsResults) {
      totalViews += s.pageviews ?? 0;
      uniqueVisitors += s.visitors ?? 0;
    }

    // Aggregate daily pageviews and sessions (uniques) by date
    const dailyMap = new Map<string, number>();
    const dailyUniquesMap = new Map<string, number>();
    for (const pv of pageviewsResults) {
      for (const entry of pv.pageviews) {
        const date = entry.x.slice(0, 10);
        dailyMap.set(date, (dailyMap.get(date) ?? 0) + entry.y);
      }
      for (const entry of pv.sessions) {
        const date = entry.x.slice(0, 10);
        dailyUniquesMap.set(date, (dailyUniquesMap.get(date) ?? 0) + entry.y);
      }
    }

    // Aggregate referrer metrics (skip empty/null referrers)
    const referrerMap = new Map<string, number>();
    for (const metrics of referrerResults) {
      for (const m of metrics) {
        if (m.x) {
          referrerMap.set(m.x, (referrerMap.get(m.x) ?? 0) + m.y);
        }
      }
    }

    // Aggregate device metrics
    const deviceMap = new Map<string, number>();
    for (const metrics of deviceResults) {
      for (const m of metrics) {
        const key = m.x || "unknown";
        deviceMap.set(key, (deviceMap.get(key) ?? 0) + m.y);
      }
    }

    // Aggregate country metrics
    const countryMap = new Map<string, number>();
    for (const metrics of countryResults) {
      for (const m of metrics) {
        const key = m.x || "unknown";
        countryMap.set(key, (countryMap.get(key) ?? 0) + m.y);
      }
    }

    // Build topReferrers (sorted desc, top 10)
    const topReferrers = [...referrerMap.entries()]
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Direct visits = total views minus all known referrer views
    const allReferrerTotal = [...referrerMap.values()].reduce((sum, c) => sum + c, 0);
    const directVisits = Math.max(0, totalViews - allReferrerTotal);

    // Device breakdown (sorted desc)
    const deviceBreakdown = [...deviceMap.entries()]
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);

    // Country breakdown (sorted desc, top 10)
    const countryBreakdown = [...countryMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Fill missing dates for chart continuity
    const days = periodToDays(period);
    const viewsByDay = fillMissingDates(dailyMap, dailyUniquesMap, days);

    return Response.json(
      {
        totalViews,
        uniqueVisitors,
        viewsByDay,
        topReferrers,
        directVisits,
        deviceBreakdown,
        countryBreakdown,
        period,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("[analytics/stats] Umami API error:", err);
    return Response.json({ error: "Analytics temporarily unavailable" }, { status: 503 });
  }
}

/**
 * Fill in missing dates with zero values so the chart has continuous data points.
 */
function fillMissingDates(
  dailyMap: Map<string, number>,
  dailyUniquesMap: Map<string, number>,
  days: number,
): Array<{ date: string; views: number; uniques: number }> {
  const result: Array<{ date: string; views: number; uniques: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    result.push({ date, views: dailyMap.get(date) ?? 0, uniques: dailyUniquesMap.get(date) ?? 0 });
  }

  return result;
}
