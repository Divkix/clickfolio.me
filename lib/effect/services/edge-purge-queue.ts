import { Context, Effect, Layer } from "effect";
import type { EdgePurgeMessage } from "@/lib/cache/edge-purge";
import { externalCall } from "@/lib/effect/external";
import { QueueFailed } from "@/lib/effect/failures";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";

type EdgePurgeQueueService = {
  /**
   * One `sendBatch` to the purge queue. A timeout only stops waiting: the batch may still have
   * landed, so callers never resend it. A duplicate purge is harmless, but spends rate budget.
   */
  readonly sendBatch: (
    messages: ReadonlyArray<MessageSendRequest<EdgePurgeMessage>>,
  ) => Effect.Effect<void, QueueFailed>;
};

function service(queue: Queue<EdgePurgeMessage>): EdgePurgeQueueService {
  return {
    sendBatch: (messages) =>
      externalCall({
        operation: "queue.edge_purge.send",
        timeoutMs: TIMEOUT_MS.queue,
        run: async () => {
          await queue.sendBatch(messages);
        },
        fail: (details) => new QueueFailed(details),
      }),
  };
}

/** Producer side of `EDGE_PURGE_QUEUE`; the consumer is `processEdgePurgeBatch`. */
export class EdgePurgeQueue extends Context.Service<EdgePurgeQueue, EdgePurgeQueueService>()(
  "clickfolio/EdgePurgeQueue",
) {
  static layer(queue: Queue<EdgePurgeMessage>): Layer.Layer<EdgePurgeQueue> {
    return Layer.sync(EdgePurgeQueue, () => service(queue));
  }
}
