import { env } from "cloudflare:workers";
import {
  CloudflareCdnCacheAdapter,
  encodeCloudflareCacheTag,
} from "@vinext/cloudflare/cache/cdn-adapter.runtime";
import { enqueueEdgePurge, type EdgePurgeMessage } from "@/lib/cache/edge-purge";

/**
 * vinext's Workers Cache CDN adapter with queued purges.
 *
 * Everything (response headers, `Cache-Tag` digests, version validation) is
 * inherited. Only `revalidateTag` changes: instead of calling
 * `ctx.cache.purge()` inline from the request that changed data, which spends
 * one of the account's 5 purges a minute per request and fails silently when
 * rate-limited, it enqueues the encoded tags for the purge consumer in
 * `worker/index.ts`. The consumer purges from the cached entrypoint, because
 * a purge only reaches the entrypoint that calls it.
 *
 * Stale-while-revalidate durations are ignored: every caller here uses
 * `revalidatePath`, which is a hard purge.
 */
export class QueuedPurgeCdnCacheAdapter extends CloudflareCdnCacheAdapter {
  readonly #queue: Queue<EdgePurgeMessage> | undefined;

  constructor(queue: Queue<EdgePurgeMessage> | undefined, versionMetadata?: WorkerVersionMetadata) {
    super(versionMetadata);
    this.#queue = queue;
  }

  override async revalidateTag(tags: string | string[]): Promise<void> {
    const list = Array.isArray(tags) ? tags : [tags];

    await enqueueEdgePurge(this.#queue, list.map(encodeCloudflareCacheTag));
  }
}

/** Factory imported by vinext's generated cache-adapter registration. */
export default function createQueuedPurgeCdnCacheAdapter(): QueuedPurgeCdnCacheAdapter {
  return new QueuedPurgeCdnCacheAdapter(env.EDGE_PURGE_QUEUE, env.CF_VERSION_METADATA);
}
