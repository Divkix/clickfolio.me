/**
 * Custom worker entry point that wraps vinext's generated handler
 * and adds Cloudflare Queue consumer support and Durable Object exports.
 */
/// <reference path="../lib/cloudflare-env.d.ts" />

import handler from "vinext/server/app-router-entry";
import { performCleanup } from "../lib/cron/cleanup";
import { performR2Cleanup } from "../lib/cron/cleanup-r2";
import { recoverOrphanedResumes } from "../lib/cron/recover-orphaned";
import { syncDisposableDomains } from "../lib/cron/sync-disposable-domains";
import { getDb } from "../lib/db";
import { handleQueueMessage } from "../lib/queue/consumer";
import { handleDLQMessage } from "../lib/queue/dlq-consumer";
import { isRetryableError } from "../lib/queue/errors";
import { queueMessageSchema } from "../lib/queue/types";

// Re-export Durable Object class for Wrangler to discover
export { ClickfolioStatusDO } from "../lib/durable-objects/resume-status";

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default {
  async fetch(request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Intercept WebSocket upgrade requests for resume status
    if (
      url.pathname === "/ws/resume-status" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      const resumeId = url.searchParams.get("resume_id");
      if (!resumeId) {
        return new Response("Missing resume_id query parameter", { status: 400 });
      }

      // Route to the Durable Object keyed by resumeId
      if (!env.CLICKFOLIO_STATUS_DO) {
        return new Response("WebSocket not available", { status: 503 });
      }

      const doId = env.CLICKFOLIO_STATUS_DO.idFromName(resumeId);
      const stub = env.CLICKFOLIO_STATUS_DO.get(doId);

      // Forward the WebSocket upgrade request to the DO
      return stub.fetch(request);
    }

    // All other requests go to vinext handler
    // Note: vinext uses cloudflare:workers internally for env access
    const response = await handler.fetch(request);
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },

  // Cloudflare Queue consumer handler
  async queue(batch: MessageBatch<unknown>, env: CloudflareEnv): Promise<void> {
    const isDLQ = batch.queue === "clickfolio-parse-dlq";

    for (const message of batch.messages) {
      try {
        const parsed = queueMessageSchema.safeParse(message.body);
        if (!parsed.success) {
          console.error("Invalid queue message shape:", parsed.error.flatten());
          message.ack(); // discard malformed messages
          continue;
        }

        if (isDLQ) {
          await handleDLQMessage(parsed.data, env);
          message.ack();
          continue;
        }

        await handleQueueMessage(parsed.data, env);
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

  // Cloudflare Cron trigger handler
  // Calls shared functions directly to avoid self-fetch (which doubles Worker invocations billed).
  async scheduled(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
    const db = getDb(env.CLICKFOLIO_DB);

    try {
      switch (controller.cron) {
        case "0 2 * * *": {
          // Daily at 2 AM UTC - R2 temp file cleanup
          const r2Binding = env.CLICKFOLIO_R2_BUCKET;
          if (!r2Binding) {
            console.error("CLICKFOLIO_R2_BUCKET not available for R2 cleanup");
            return;
          }
          const result = await performR2Cleanup(r2Binding);
          console.log(`Cron ${controller.cron} completed:`, result);
          break;
        }
        case "0 3 * * *": {
          const result = await performCleanup(db);
          console.log(`Cron ${controller.cron} completed:`, result);
          break;
        }
        case "0 4 * * *": {
          const kv = env.CLICKFOLIO_DISPOSABLE_DOMAINS;
          if (!kv) {
            console.error("CLICKFOLIO_DISPOSABLE_DOMAINS KV not available for domain sync");
            return;
          }
          const syncResult = await syncDisposableDomains(kv);
          console.log(`Cron ${controller.cron} completed:`, syncResult);
          break;
        }
        case "*/15 * * * *": {
          const queue = env.CLICKFOLIO_PARSE_QUEUE;
          if (!queue) {
            console.error("CLICKFOLIO_PARSE_QUEUE not available for orphan recovery");
            return;
          }
          const result = await recoverOrphanedResumes(db, queue);
          console.log(`Cron ${controller.cron} completed:`, result);
          break;
        }
        default:
          console.error(`Unknown cron trigger: ${controller.cron}`);
      }
    } catch (error) {
      console.error(`Cron ${controller.cron} error:`, error);
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
