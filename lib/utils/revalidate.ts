import { env, waitUntil } from "cloudflare:workers";
import { publicProfileTags } from "@/lib/cache/edge-cache";
import { enqueueEdgePurge } from "@/lib/cache/edge-purge";
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";

/**
 * Purges the edge-cached pages a profile change can affect: each profile page and the example
 * galleries. Enqueues their Cache-Tags for the purge consumer after the response (waitUntil).
 *
 * Best-effort by design: a cache purge must never fail the write that triggered it.
 */
export function revalidatePublicProfilePages(
  handles: ReadonlyArray<string | null | undefined>,
): void {
  try {
    waitUntil(enqueueEdgePurge(env.EDGE_PURGE_QUEUE, publicProfileTags(handles)));
  } catch (error) {
    log("error", "Failed to revalidate public profile pages", { ...errorFields(error) });
  }
}
