import { Effect } from "effect";
import { env } from "cloudflare:workers";
import { withAdminEffect } from "@/lib/auth/with-auth";
import { InvalidInput, type ServerFailure } from "@/lib/effect/failures";
import { Umami } from "@/lib/effect/services/umami";
import { lastNUtcDays } from "@/lib/utils/date-axis";
import { createSuccessResponse } from "@/lib/utils/security-headers";

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);

function isProfilePath(path: string): boolean {
  if (!path.startsWith("/@")) return false;
  const segments = path.split("/").filter(Boolean);

  return segments.length === 1 && segments[0].startsWith("@") && segments[0].length > 1;
}

function loadAnalytics(request: Request): Effect.Effect<Response, ServerFailure, Umami> {
  return Effect.gen(function* () {
    const period = new URL(request.url).searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return yield* Effect.fail(new InvalidInput({ message: "Invalid period" }));
    }

    const days = Number.parseInt(period, 10);
    const now = Date.now();
    const startAt = now - days * 24 * 60 * 60 * 1000;

    const [stats, pageviews, urlMetrics, referrerMetrics, countryMetrics, deviceMetrics] =
      yield* Effect.all(
        [
          Umami.use((umami) => umami.getStats({ startAt, endAt: now })),
          Umami.use((umami) =>
            umami.getPageviews({ startAt, endAt: now, unit: "day", timezone: "UTC" }),
          ),
          Umami.use((umami) =>
            umami.getMetrics({
              type: "path",
              startAt,
              endAt: now,
              unit: "day",
              timezone: "UTC",
              limit: 50,
            }),
          ),
          Umami.use((umami) =>
            umami.getMetrics({
              type: "referrer",
              startAt,
              endAt: now,
              unit: "day",
              timezone: "UTC",
              limit: 10,
            }),
          ),
          Umami.use((umami) =>
            umami.getMetrics({
              type: "country",
              startAt,
              endAt: now,
              unit: "day",
              timezone: "UTC",
              limit: 10,
            }),
          ),
          Umami.use((umami) =>
            umami.getMetrics({ type: "device", startAt, endAt: now, unit: "day", timezone: "UTC" }),
          ),
        ],
        { concurrency: "unbounded" },
      );

    // Totals (Umami v2.12+ returns flat numbers)
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

    // Daily breakdown — map Umami {x, y} to {date, views, unique}
    // Umami returns x as full ISO timestamp (e.g. "2026-02-09T00:00:00Z") when timezone=UTC,
    // so normalize to YYYY-MM-DD for consistent date matching across the date axis.
    const sessionMap = new Map(pageviews.sessions.map((s) => [s.x.slice(0, 10), s.y]));

    const dailyData = pageviews.pageviews.map((p) => ({
      date: p.x.slice(0, 10),
      views: p.y,
      unique: sessionMap.get(p.x.slice(0, 10)) ?? 0,
    }));

    const dailyMap = new Map(dailyData.map((d) => [d.date, d]));

    const daily = lastNUtcDays(days).map(
      (date) => dailyMap.get(date) ?? { date, views: 0, unique: 0 },
    );

    const profileMetrics = urlMetrics.filter((m) => isProfilePath(m.x)).slice(0, 10);
    const profilesViewed = profileMetrics.length;

    const totalReferrer = referrerMetrics.reduce((sum, r) => sum + r.y, 0);

    const totalCountry = countryMetrics.reduce((sum, c) => sum + c.y, 0);

    const totalDevice = deviceMetrics.reduce((sum, d) => sum + d.y, 0);

    const responseData = {
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

    const response = createSuccessResponse(responseData);
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");

    return response;
  });
}

export async function GET(request: Request) {
  return withAdminEffect(request, () =>
    loadAnalytics(request).pipe(Effect.provide(Umami.layer(env))),
  );
}
