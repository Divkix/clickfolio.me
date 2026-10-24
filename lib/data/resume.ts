import { env } from "cloudflare:workers";
import { cacheForRequest } from "vinext/cache";
import { loadPublicResume, type PublicResume } from "@/lib/data/public-resume";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";

/**
 * Per-request memo for the row above. React's `cache()` does not span the
 * metadata and page render passes; `cacheForRequest` keys into vinext's
 * per-request WeakMap (node_modules/vinext/dist/shims/cache-for-request.js:59),
 * which lives in the request's AsyncLocalStorage context and is shared by every
 * nested shim scope, so both consumers await the same in-flight query.
 */
const getHandleLoads = cacheForRequest(() => new Map<string, Promise<PublicResume | null>>());

/**
 * Page edge for `/@handle`: `generateMetadata` and the page share one load per request. A
 * database failure throws to the error boundary (and is never cached by the edge); only a
 * missing profile returns `null`, for the caller to turn into `notFound()`.
 */
export function getResume(handle: string): Promise<PublicResume | null> {
  const loads = getHandleLoads();
  const loaded = loads.get(handle);

  if (loaded) {
    return loaded;
  }

  const pending = runPage(loadPublicResume(handle), Db.layer(env.HYPERDRIVE));

  loads.set(handle, pending);

  return pending;
}
