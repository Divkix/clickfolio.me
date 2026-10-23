import { vi } from "vite-plus/test";
import type { EdgePurgeMessage } from "@/lib/cache/edge-purge";

type SendBatch = Queue<EdgePurgeMessage>["sendBatch"];

const NO_METRICS = { metrics: { backlogCount: 0, backlogBytes: 0 } };

/** A producer binding whose `sendBatch` is the given spy (accepting by default). */
export function fakeQueue(
  sendBatch = vi.fn<SendBatch>(async () => ({ metadata: NO_METRICS })),
): Queue<EdgePurgeMessage> & { sendBatch: typeof sendBatch } {
  return { send: vi.fn(), sendBatch, metrics: vi.fn() };
}

/** A delivered message with `ack`/`retry` spies. */
export function fakeMessage(id: string, body: EdgePurgeMessage | string, attempts = 1) {
  const ack = vi.fn<() => void>();
  const retry = vi.fn<(options?: QueueRetryOptions) => void>();

  return { id, body, attempts, timestamp: new Date(0), ack, retry } satisfies Message<
    EdgePurgeMessage | string
  >;
}

export function fakeBatch(
  messages: ReadonlyArray<Message<EdgePurgeMessage | string>>,
): MessageBatch {
  return {
    messages,
    queue: "clickfolio-cache-purge",
    metadata: NO_METRICS,
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  };
}
