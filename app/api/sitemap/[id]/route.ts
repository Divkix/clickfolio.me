import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { Db } from "@/lib/effect/db";
import { runRoute } from "@/lib/effect/edges";
import { buildSitemapXml, generateSitemapEntries, sitemapUnavailable } from "@/lib/seo/sitemap";

function parseSitemapId(rawId: string): number | null {
  if (!/^\d+$/.test(rawId)) return null;

  const parsed = Number.parseInt(rawId, 10);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

function shardProgram(id: number, path: string) {
  const unavailable = sitemapUnavailable(path);

  return generateSitemapEntries(id).pipe(
    Effect.map((entries) => {
      // Null means the shard fell outside the indexable-user snapshot (see generateSitemapEntries).
      if (entries === null) return new Response("Sitemap shard not found", { status: 404 });

      return new Response(buildSitemapXml(entries), {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }),
    Effect.catchTags({ DbFailed: unavailable, DbConflict: unavailable }),
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await params;
  const id = parseSitemapId(rawId);

  if (id === null) {
    return new Response("Invalid sitemap id", { status: 400 });
  }

  return runRoute(
    request,
    shardProgram(id, new URL(request.url).pathname),
    Db.layer(env.HYPERDRIVE),
  );
}
