import type { CacheInvalidationMessage } from "./types";

/**
 * Publish a cache invalidation job to the queue
 */
export async function publishCacheInvalidation(
  queue: Queue<CacheInvalidationMessage>,
  params: {
    handles?: string[];
    paths?: string[];
  },
): Promise<void> {
  const message: CacheInvalidationMessage = {
    type: "invalidate",
    handles: params.handles ?? [],
    paths: params.paths ?? [],
  };

  // Only send if there's something to invalidate
  if (message.handles.length > 0 || message.paths.length > 0) {
    await queue.send(message);
  }
}

/**
 * Helper to invalidate a single handle and its path
 */
export async function invalidateHandle(
  queue: Queue<CacheInvalidationMessage>,
  handle: string,
): Promise<void> {
  await publishCacheInvalidation(queue, {
    handles: [handle],
    paths: [`/${handle}`],
  });
}
