import handler from "@tanstack/react-start/server-entry";
import { WorkerEntrypoint } from "cloudflare:workers";
import { extractClerkTokenFromRequest } from "../lib/auth/clerk";
import { edgeResponse } from "../lib/cache/edge-cache";

/**
 * The only entrypoint with Workers Cache on (wrangler.jsonc `exports`). The default entrypoint
 * renders pages through it, so a page that opted in with `edgeCacheHeaders()` is answered from
 * the cache without running the app. Purges are entrypoint-scoped, so they run here too.
 * https://developers.cloudflare.com/workers/cache/
 */
export class CachedPages extends WorkerEntrypoint<CloudflareEnv> {
  /**
   * Only renders of requests without a `__session` cookie (the one credential the server reads)
   * are stored, so a cached page never carries one visitor's session to another, whatever the
   * route's render reads. Signed-in visitors are still served cached hits.
   */
  override async fetch(request: Request): Promise<Response> {
    const shareable = extractClerkTokenFromRequest(request) === null;

    return edgeResponse(await handler.fetch(request), shareable);
  }

  /** `undefined` when this entrypoint has no cache (local dev without Workers Cache). */
  async purge(options: CachePurgeOptions): Promise<CachePurgeResult | undefined> {
    return this.ctx.cache?.purge(options);
  }
}
