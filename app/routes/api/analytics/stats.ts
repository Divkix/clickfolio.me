import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { and, desc, eq, sql } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { handleChanges, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { InvalidInput, type ServerFailure } from "@/lib/effect/failures";
import { Umami } from "@/lib/effect/services/umami";
import { lastNUtcDays } from "@/lib/utils/date-axis";
import { createSuccessResponse } from "@/lib/utils/security-headers";

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);

type MetricType = "referrer" | "device" | "country";

function emptyStats(period: string) {
  return {
    totalViews: 0,
    uniqueVisitors: 0,
    viewsByDay: [],
    topReferrers: [],
    directVisits: 0,
    deviceBreakdown: [],
    countryBreakdown: [],
    period,
  };
}

function loadHandleSet(userId: string, currentHandle: string) {
  return Db.use((db) =>
    db.query("analytics.handle-set", (handle) =>
      handle
        .select({ oldHandle: handleChanges.oldHandle })
        .from(handleChanges)
        .where(
          and(
            eq(handleChanges.userId, userId),
            sql`not exists (
              select 1 from ${user}
              where ${user.handle} = ${handleChanges.oldHandle} and ${user.id} <> ${userId}
            )`,
          ),
        )
        .orderBy(desc(handleChanges.createdAt))
        .limit(3),
    ),
  ).pipe(
    Effect.map((rows) => {
      const set = new Set([currentHandle]);

      for (const row of rows) {
        if (row.oldHandle) {
          set.add(row.oldHandle);
        }
      }

      return set;
    }),
  );
}

function loadStats(
  request: Request,
  dbUser: { id: string; handle: string | null },
): Effect.Effect<Response, ServerFailure, Db | Umami> {
  return Effect.gen(function* () {
    const period = new URL(request.url).searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return yield* Effect.fail(
        new InvalidInput({ message: "Invalid period. Use 7d, 30d, or 90d." }),
      );
    }

    const currentHandle = dbUser.handle;

    if (!currentHandle) {
      return createSuccessResponse(emptyStats(period));
    }

    const days = Number.parseInt(period, 10);
    const endAt = Date.now();
    const startAt = endAt - days * 24 * 60 * 60 * 1000;

    const handleSet = yield* loadHandleSet(dbUser.id, currentHandle);
    const handlePaths = [...handleSet].map((h) => `/@${h}`);

    const metrics = (type: MetricType) =>
      Effect.forEach(
        handlePaths,
        (path) =>
          Umami.use((umami) =>
            umami.getMetrics({ startAt, endAt, type, unit: "day", timezone: "UTC", path }),
          ),
        { concurrency: "unbounded" },
      );

    const [statsResults, pageviewsResults, referrerResults, deviceResults, countryResults] =
      yield* Effect.all(
        [
          Effect.forEach(
            handlePaths,
            (path) => Umami.use((umami) => umami.getStats({ startAt, endAt, path })),
            { concurrency: "unbounded" },
          ),
          Effect.forEach(
            handlePaths,
            (path) =>
              Umami.use((umami) =>
                umami.getPageviews({ startAt, endAt, unit: "day", timezone: "UTC", path }),
              ),
            { concurrency: "unbounded" },
          ),
          metrics("referrer"),
          metrics("device"),
          metrics("country"),
        ],
        { concurrency: "unbounded" },
      );

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

    for (const rows of referrerResults) {
      for (const m of rows) {
        if (m.x) {
          referrerMap.set(m.x, (referrerMap.get(m.x) ?? 0) + m.y);
        }
      }
    }

    const deviceMap = new Map<string, number>();

    for (const rows of deviceResults) {
      for (const m of rows) {
        const key = m.x || "unknown";
        deviceMap.set(key, (deviceMap.get(key) ?? 0) + m.y);
      }
    }

    const countryMap = new Map<string, number>();

    for (const rows of countryResults) {
      for (const m of rows) {
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

    response.headers.set("Cache-Control", "private, max-age=60");

    return response;
  });
}

export const Route = createFileRoute("/api/analytics/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return withUserEffect(
          request,
          ({ dbUser }) => loadStats(request, dbUser).pipe(Effect.provide(Umami.layer(env))),
          "Must be logged in to view analytics",
        );
      },
    },
  },
});
