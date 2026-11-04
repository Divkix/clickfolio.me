import { Effect } from "effect";
import { z } from "zod";
import { Analytics } from "@/lib/effect/services/analytics";
import { analyticsWindow, lastNDays } from "@/lib/utils/date-axis";

export const analyticsPeriodSchema = z.enum(["7d", "30d", "90d"]);

export type AnalyticsPeriod = z.infer<typeof analyticsPeriodSchema>;

function isProfilePath(path: string): boolean {
  if (!path.startsWith("/@")) return false;
  const segments = path.split("/").filter(Boolean);

  return segments.length === 1 && segments[0].startsWith("@") && segments[0].length > 1;
}

export function loadAdminAnalytics(period: AnalyticsPeriod, timezone = "UTC") {
  return Effect.gen(function* () {
    const days = Number.parseInt(period, 10);
    const { startAt, endAt } = analyticsWindow(days, timezone);

    const [stats, pageviews, urlMetrics, referrerMetrics, countryMetrics, deviceMetrics] =
      yield* Effect.all(
        [
          Analytics.use((analytics) => analytics.getStats({ startAt, endAt, timezone })),
          Analytics.use((analytics) =>
            analytics.getPageviews({ startAt, endAt, unit: "day", timezone }),
          ),
          Analytics.use((analytics) =>
            analytics.getMetrics({
              type: "path",
              startAt,
              endAt,
              unit: "day",
              timezone,
              limit: 50,
            }),
          ),
          Analytics.use((analytics) =>
            analytics.getMetrics({
              type: "referrer",
              startAt,
              endAt,
              unit: "day",
              timezone,
              limit: 10,
            }),
          ),
          Analytics.use((analytics) =>
            analytics.getMetrics({
              type: "country",
              startAt,
              endAt,
              unit: "day",
              timezone,
              limit: 10,
            }),
          ),
          Analytics.use((analytics) =>
            analytics.getMetrics({
              type: "device",
              startAt,
              endAt,
              unit: "day",
              timezone,
            }),
          ),
        ],
        { concurrency: "unbounded" },
      );

    // Current and previous period totals.
    const totalViews = stats.pageviews ?? 0;
    const totalUnique = stats.visitors ?? 0;
    const prevViews = stats.comparison?.pageviews ?? 0;
    const prevUnique = stats.comparison?.visitors ?? 0;
    const avgPerDay = Math.round(totalViews / days);
    const prevAvgPerDay = Math.round(prevViews / days);

    const viewsChange =
      prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 100) : 0;

    const uniqueChange =
      prevUnique > 0 ? Math.round(((totalUnique - prevUnique) / prevUnique) * 100) : 0;

    const avgChange =
      prevAvgPerDay > 0 ? Math.round(((avgPerDay - prevAvgPerDay) / prevAvgPerDay) * 100) : 0;

    // Umami's x values are local calendar labels, so preserve their date instead of parsing as UTC.
    const sessionMap = new Map(pageviews.sessions.map((s) => [s.x.slice(0, 10), s.y]));

    const dailyData = pageviews.pageviews.map((p) => ({
      date: p.x.slice(0, 10),
      views: p.y,
      unique: sessionMap.get(p.x.slice(0, 10)) ?? 0,
    }));

    const dailyMap = new Map(dailyData.map((d) => [d.date, d]));

    const daily = lastNDays(days, timezone, endAt).map(
      (date) => dailyMap.get(date) ?? { date, views: 0, unique: 0 },
    );

    const profileMetrics = urlMetrics.filter((m) => isProfilePath(m.x)).slice(0, 10);
    const profilesViewed = profileMetrics.length;

    const totalReferrer = referrerMetrics.reduce((sum, r) => sum + r.y, 0);

    const totalCountry = countryMetrics.reduce((sum, c) => sum + c.y, 0);

    const totalDevice = deviceMetrics.reduce((sum, d) => sum + d.y, 0);

    return {
      totals: {
        views: totalViews,
        unique: totalUnique,
        avgPerDay,
        profilesViewed,
      },
      changes: {
        views: viewsChange,
        unique: uniqueChange,
        avgPerDay: avgChange,
      },
      daily,
      topProfiles: profileMetrics.map((m) => ({
        handle: m.x.replace(/^\/@/, ""),
        views: m.y,
      })),
      referrers: referrerMetrics.map((r) => ({
        domain: r.x || "Direct",
        count: r.y,
        percent: totalReferrer > 0 ? Math.round((r.y / totalReferrer) * 100) : 0,
      })),
      countries: countryMetrics.map((c) => ({
        code: c.x || "unknown",
        name: c.x || "Unknown",
        percent: totalCountry > 0 ? Math.round((c.y / totalCountry) * 100) : 0,
      })),
      devices: deviceMetrics.map((d) => ({
        type: d.x || "unknown",
        percent: totalDevice > 0 ? Math.round((d.y / totalDevice) * 100) : 0,
      })),
    };
  });
}

export interface AdminAnalyticsData {
  totals: {
    views: number;
    unique: number;
    avgPerDay: number;
    profilesViewed: number;
  };
  changes: {
    views: number;
    unique: number;
    avgPerDay: number;
  };
  daily: Array<{ date: string; views: number; unique: number }>;
  topProfiles: Array<{ handle: string; views: number }>;
  referrers: Array<{ domain: string; count: number; percent: number }>;
  countries: Array<{ code: string; name: string; percent: number }>;
  devices: Array<{ type: string; percent: number }>;
}
