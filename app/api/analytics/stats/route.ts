import { desc, eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { handleChanges } from "@/lib/db/schema";
import { getMetrics, getPageviews, getStats } from "@/lib/umami/client";
import { lastNUtcDays } from "@/lib/utils/date-axis";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);

export async function GET(request: Request) {
  return withUser(
    request,
    async ({ db, dbUser, env }) => {
      const url = new URL(request.url);
      const period = url.searchParams.get("period") || "7d";

      if (!VALID_PERIODS.has(period)) {
        return createErrorResponse(
          "Invalid period. Use 7d, 30d, or 90d.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }

      const currentHandle = dbUser.handle;
      if (!currentHandle) {
        return createSuccessResponse({
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
        const days = Number.parseInt(period, 10);
        const endAt = Date.now();
        const startAt = endAt - days * 24 * 60 * 60 * 1000;

        const oldHandleRows = await db
          .select({ oldHandle: handleChanges.oldHandle })
          .from(handleChanges)
          .where(eq(handleChanges.userId, dbUser.id))
          .orderBy(desc(handleChanges.createdAt))
          .limit(3);

        const handleSet = new Set([currentHandle]);
        for (const row of oldHandleRows) {
          if (row.oldHandle) {
            handleSet.add(row.oldHandle);
          }
        }
        const handlePaths = [...handleSet].map((h) => `/@${h}`);

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

        const referrerMap = new Map<string, number>();
        for (const metrics of referrerResults) {
          for (const m of metrics) {
            if (m.x) {
              referrerMap.set(m.x, (referrerMap.get(m.x) ?? 0) + m.y);
            }
          }
        }

        const deviceMap = new Map<string, number>();
        for (const metrics of deviceResults) {
          for (const m of metrics) {
            const key = m.x || "unknown";
            deviceMap.set(key, (deviceMap.get(key) ?? 0) + m.y);
          }
        }

        const countryMap = new Map<string, number>();
        for (const metrics of countryResults) {
          for (const m of metrics) {
            const key = m.x || "unknown";
            countryMap.set(key, (countryMap.get(key) ?? 0) + m.y);
          }
        }

        const topReferrers = [...referrerMap.entries()]
          .map(([referrer, count]) => ({ referrer, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const allReferrerTotal = [...referrerMap.values()].reduce((sum, c) => sum + c, 0);
        const directVisits = Math.max(0, totalViews - allReferrerTotal);

        const deviceBreakdown = [...deviceMap.entries()]
          .map(([device, count]) => ({ device, count }))
          .sort((a, b) => b.count - a.count);

        const countryBreakdown = [...countryMap.entries()]
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const viewsByDay = lastNUtcDays(days).map((date) => ({
          date,
          views: dailyMap.get(date) ?? 0,
          uniques: dailyUniquesMap.get(date) ?? 0,
        }));

        const response = createSuccessResponse({
          totalViews,
          uniqueVisitors,
          viewsByDay,
          topReferrers,
          directVisits,
          deviceBreakdown,
          countryBreakdown,
          period,
        });
        response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
        return response;
      } catch (err) {
        console.error("[analytics/stats] Umami API error:", err);
        return createErrorResponse(
          "Analytics temporarily unavailable",
          ERROR_CODES.INTERNAL_ERROR,
          503,
        );
      }
    },
    "Must be logged in to view analytics",
  );
}
