/**
 * Custom worker entry point that wraps OpenNext's generated handler
 * and adds Cloudflare Queue consumer support.
 *
 * Note: This file is excluded from Next.js tsconfig because it imports
 * .open-next/worker.js which only exists after OpenNext build.
 * Wrangler handles bundling and type resolution separately.
 */
/// <reference types="@cloudflare/workers-types" />
/// <reference path="./lib/cloudflare-env.d.ts" />

import { handleQueueMessage } from "./lib/queue/consumer";
import type { QueueMessage } from "./lib/queue/types";
import opennextHandler from "./.open-next/worker.js";

export default {
  // Re-use the OpenNext fetch handler
  fetch: opennextHandler.fetch,

  // Cloudflare Queue consumer handler
  async queue(batch: MessageBatch<unknown>, env: CloudflareEnv): Promise<void> {
    for (const message of batch.messages) {
      try {
        await handleQueueMessage(message.body as QueueMessage, env);
        message.ack();
      } catch (error) {
        console.error("Queue message processing failed:", error);
        // Message will be retried based on queue config
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;

// Re-export Durable Objects classes for OpenNext cache system
export { DOShardedTagCache } from "./.open-next/worker.js";
