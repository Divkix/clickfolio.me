/**
 * Custom worker entry point that wraps OpenNext's generated handler
 * and adds Cloudflare Queue consumer support.
 *
 * Note: This file is excluded from Next.js tsconfig because it imports
 * .open-next/worker.js which only exists after OpenNext build.
 * Wrangler handles bundling and type resolution separately.
 */
/// <reference path="./lib/cloudflare-env.d.ts" />

import opennextHandler from "./.open-next/worker.js";
import { handleQueueMessage } from "./lib/queue/consumer";
import { handleDLQMessage } from "./lib/queue/dlq-consumer";
import { isRetryableError } from "./lib/queue/errors";
import type { QueueMessage } from "./lib/queue/types";

export default {
  // Re-use the OpenNext fetch handler
  fetch: opennextHandler.fetch,

  // Cloudflare Queue consumer handler
  async queue(batch: MessageBatch<unknown>, env: CloudflareEnv): Promise<void> {
    const isDLQ = batch.queue === "resume-parse-dlq";

    for (const message of batch.messages) {
      try {
        if (isDLQ) {
          await handleDLQMessage(message.body as QueueMessage, env);
          message.ack();
          continue;
        }

        await handleQueueMessage(message.body as QueueMessage, env);
        message.ack();
      } catch (error) {
        console.error("Queue message processing failed:", error);

        // Use error classification to determine retry strategy
        if (isRetryableError(error)) {
          message.retry();
        } else {
          // Permanent error - ack to send to DLQ
          console.error("Permanent error, sending to DLQ");
          message.ack();
        }
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
