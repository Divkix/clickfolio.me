// eslint-disable-next-line typescript/triple-slash-reference -- required for Cloudflare Workers env types; import-style not supported here
/// <reference path="../lib/cloudflare-env.d.ts" />

import { eq } from "drizzle-orm";
import handler from "vinext/server/app-router-entry";
import { extractClerkTokenFromRequest, verifyClerkToken } from "../lib/auth/clerk";
import { performCleanup } from "../lib/cron/cleanup";
import { performR2Cleanup, retryPendingR2Deletions } from "../lib/cron/cleanup-r2";
import { recoverOrphanedResumes } from "../lib/cron/recover-orphaned";
import { getDb } from "../lib/db";
import { resumes, user as userTable } from "../lib/db/schema";
import { INFRA } from "@/lib/resume/lifecycle";
import { handleQueueMessage } from "../lib/queue/consumer";
import { handleDLQMessage } from "../lib/queue/dlq-consumer";
import { isRetryableError, type QueueErrorInput } from "../lib/queue/errors";
import { queueMessageSchema } from "../lib/queue/types";
import { log } from "../lib/utils/log";
// See issue #172 / ADR-0001.
import { SECURITY_HEADERS } from "../lib/utils/security-headers";

export { ClickfolioStatusDO } from "../lib/durable-objects/resume-status";

const BLOCKED_PATHS =
  /(?:\.php$|^\/\.env|^\/\.git\/|^\/\.aws\/|^\/wp-|^\/xmlrpc\.php$|(?:^|\/)adminer(?:\/|$)|^\/config\.json$|application\.ya?ml$)/i;

export default {
  async fetch(request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (BLOCKED_PATHS.test(url.pathname)) {
      return new Response("Not Found", { status: 404, headers: SECURITY_HEADERS });
    }

    // Manually intercept WebSocket upgrade requests for resume status.
    // TODO(vinext): Remove once vinext handles WebSocket upgrades upstream;
    // this auth interception exists only because vinext does not route them.
    if (
      url.pathname === "/ws/resume-status" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      const resumeId = url.searchParams.get("resume_id");
      if (!resumeId) {
        return new Response("Missing resume_id query parameter", { status: 400 });
      }

      const token = extractClerkTokenFromRequest(request);
      const claims = token ? await verifyClerkToken(token) : null;

      if (!claims?.sub) {
        return new Response("Unauthorized: Invalid session", { status: 401 });
      }

      const db = getDb(env.HYPERDRIVE);
      const owner = await db.query.user.findFirst({
        where: eq(userTable.clerkId, claims.sub),
        columns: { id: true },
      });

      if (!owner) {
        return new Response("Unauthorized: Unknown user", { status: 401 });
      }

      const userId = owner.id;

      const resume = await db.query.resumes.findFirst({
        where: eq(resumes.id, resumeId),
        columns: { id: true, userId: true },
      });

      if (!resume) {
        return new Response("Resume not found", { status: 404 });
      }

      if (resume.userId !== userId) {
        return new Response("Forbidden: You don't own this resume", { status: 403 });
      }

      if (!env.CLICKFOLIO_STATUS_DO) {
        return new Response("WebSocket not available", { status: 503 });
      }

      const doId = env.CLICKFOLIO_STATUS_DO.idFromName(resumeId);
      const stub = env.CLICKFOLIO_STATUS_DO.get(doId);

      // Forward the WebSocket upgrade request to the DO with the authenticated
      // user header. Headers.set (not object spread) guarantees a client-supplied
      // x-authenticated-user-id is overwritten — object keys are case-sensitive,
      // header names are not, so spread would leave both values behind.
      const forwardedHeaders = new Headers(request.headers);
      forwardedHeaders.set("X-Authenticated-User-Id", userId);
      const modifiedRequest = new Request(request, { headers: forwardedHeaders });

      return stub.fetch(modifiedRequest);
    }

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

  async queue(batch: MessageBatch<unknown>, env: CloudflareEnv): Promise<void> {
    const isDLQ = batch.queue === INFRA.DLQ_NAME;

    for (const message of batch.messages) {
      try {
        const parsed = queueMessageSchema.safeParse(message.body);
        if (!parsed.success) {
          log("error", "invalid queue message shape", {
            queue: batch.queue,
            error: JSON.stringify(parsed.error.flatten()),
          });
          message.ack();
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
        log("error", "queue message processing failed", {
          queue: batch.queue,
          error: String(error),
        });

        // Use error classification to determine retry strategy
        // SAFETY: catch error is unknown; QueueErrorInput covers Error|string|object for retry check.
        if (isRetryableError(error as QueueErrorInput)) {
          message.retry();
        } else {
          // Permanent error — ack discards the message (acked messages never
          // reach the DLQ). The consumer already marked the resume failed and
          // sent the alert before rethrowing, so nothing more is needed here.
          log("error", "permanent error, discarding message", { queue: batch.queue });
          message.ack();
        }
      }
    }
  },

  async scheduled(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
    const db = getDb(env.HYPERDRIVE);

    try {
      switch (controller.cron) {
        case "0 2 * * *": {
          const r2Binding = env.CLICKFOLIO_R2_BUCKET;
          if (!r2Binding) {
            log("error", "CLICKFOLIO_R2_BUCKET not available for R2 cleanup", {
              cron: controller.cron,
            });
            return;
          }
          const [cleanupSettled, pendingSettled] = await Promise.allSettled([
            performR2Cleanup(r2Binding),
            retryPendingR2Deletions(db, r2Binding),
          ]);
          if (cleanupSettled.status === "fulfilled") {
            log("info", "cron R2 cleanup completed", {
              cron: controller.cron,
              result: cleanupSettled.value,
            });
          } else {
            log("error", "cron R2 cleanup failed", {
              cron: controller.cron,
              error: String(cleanupSettled.reason),
            });
          }
          if (pendingSettled.status === "fulfilled") {
            log("info", "cron pending deletions sweep completed", {
              cron: controller.cron,
              result: pendingSettled.value,
            });
          } else {
            log("error", "cron pending deletions sweep failed", {
              cron: controller.cron,
              error: String(pendingSettled.reason),
            });
          }
          break;
        }
        case "0 3 * * *": {
          const result = await performCleanup(db, env.CLICKFOLIO_R2_BUCKET ?? null);
          log("info", "cron completed", { cron: controller.cron, result });
          break;
        }
        case "*/15 * * * *": {
          const queue = env.CLICKFOLIO_PARSE_QUEUE;
          if (!queue) {
            log("error", "CLICKFOLIO_PARSE_QUEUE not available for orphan recovery", {
              cron: controller.cron,
            });
            return;
          }
          const result = await recoverOrphanedResumes(db, queue);
          log("info", "cron completed", { cron: controller.cron, result });
          break;
        }
        default:
          log("error", "unknown cron trigger", { cron: controller.cron });
      }
    } catch (error) {
      log("error", "cron error", { cron: controller.cron, error: String(error) });
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
