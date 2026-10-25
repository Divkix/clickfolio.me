import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { Db } from "@/lib/effect/db";
import { runRoute } from "@/lib/effect/edges";
import {
  buildSitemapIndexXml,
  getSitemapShardCount,
  getTotalIndexableUserCount,
  sitemapUnavailable,
} from "@/lib/seo/sitemap";

function indexProgram() {
  const unavailable = sitemapUnavailable("/sitemap.xml");

  return getTotalIndexableUserCount().pipe(
    Effect.map(
      (count) =>
        new Response(buildSitemapIndexXml(getSitemapShardCount(count)), {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
            "CDN-Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
        }),
    ),
    Effect.catchTags({ DbFailed: unavailable, DbConflict: unavailable }),
  );
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return runRoute(request, indexProgram(), Db.layer(env.HYPERDRIVE));
      },
    },
  },
});
