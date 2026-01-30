/**
 * Custom worker entry point that wraps OpenNext's generated handler
 * and adds Cloudflare Queue consumer support and Durable Object exports.
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

// Re-export Durable Object class for Wrangler to discover
export { ResumeStatusDO } from "./lib/durable-objects/resume-status";

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
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
      if (!env.RESUME_STATUS_DO) {
        return new Response("WebSocket not available", { status: 503 });
      }

      const doId = env.RESUME_STATUS_DO.idFromName(resumeId);
      const stub = env.RESUME_STATUS_DO.get(doId);

      // Forward the WebSocket upgrade request to the DO
      return stub.fetch(request);
    }

    // Serve static assets from ASSETS binding
    // The ASSETS binding serves files from .open-next/assets/ which contains /public/* files
    const staticFilePattern =
      /\.(ico|png|svg|webp|jpg|jpeg|gif|webmanifest|xml|txt|woff|woff2|ttf|eot|css|js|json)$/i;
    if (staticFilePattern.test(url.pathname) && env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      // Return asset if found, otherwise fall through to OpenNext for dynamically generated files
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    // All other requests go to the OpenNext handler
    // Cast needed: wrapper function receives CfProperties but opennextHandler expects IncomingRequestCfProperties
    return opennextHandler.fetch(request as Parameters<typeof opennextHandler.fetch>[0], env, ctx);
  },

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
