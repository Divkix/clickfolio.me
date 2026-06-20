/**
 * Custom worker entry point that wraps vinext's generated handler
 * and adds Cloudflare Queue consumer support and Durable Object exports.
 */
// eslint-disable-next-line typescript/triple-slash-reference -- required for Cloudflare Workers env types; import-style not supported here
/// <reference path="../lib/cloudflare-env.d.ts" />

import { eq } from "drizzle-orm";
import handler from "vinext/server/app-router-entry";
// Import auth and db session utilities for WebSocket auth
import { getAuth } from "../lib/auth";
import { performCleanup } from "../lib/cron/cleanup";
import { performR2Cleanup, retryPendingR2Deletions } from "../lib/cron/cleanup-r2";
import { recoverOrphanedResumes } from "../lib/cron/recover-orphaned";
import { syncDisposableDomains } from "../lib/cron/sync-disposable-domains";
import { getDb } from "../lib/db";
import { resumes } from "../lib/db/schema";
import { getSessionDbForWebhook } from "../lib/db/session";
import { INFRA } from "@/lib/config/retry";
import { handleQueueMessage } from "../lib/queue/consumer";
import { handleDLQMessage } from "../lib/queue/dlq-consumer";
import { isRetryableError } from "../lib/queue/errors";
import { queueMessageSchema } from "../lib/queue/types";
import { log } from "../lib/utils/log";

/** Re-exported Durable Object for WebSocket resume status updates. */
export { ClickfolioStatusDO } from "../lib/durable-objects/resume-status";

/**
 * Security headers appended to every response by the fetch handler.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Vulnerability-scanner probe paths (WordPress, exposed secrets, DB admin tools).
 * These never map to a real app route, so we 404 them at the edge of the worker
 * instead of running the full vinext/React 404 render — saving CPU on the high
 * volume of automated scanner traffic. Compiled once per isolate.
 *
 * Kept deliberately narrow so legitimate routes (`/@handle`, `/for/*`, `/api/*`,
 * `/blog/*`) can never match.
 */
const BLOCKED_PATHS =
  /(?:\.php$|^\/\.env|^\/\.git\/|^\/\.aws\/|^\/wp-|xmlrpc|adminer|^\/config\.json$|application\.ya?ml$)/i;

export default {
  /**
   * Main request handler. Routes WebSocket upgrade requests to the
   * `ClickfolioStatusDO` Durable Object and all other requests to the vinext
   * app-router handler.
   *
   * WebSocket flow:
   * 1. Intercept `/ws/resume-status` with `Upgrade: websocket`.
   * 2. Extract `resume_id` from query params.
   * 3. Validate the Better Auth session cookie.
   * 4. Verify the user owns the resume via D1.
   * 5. Forward the request to the DO keyed by `resumeId`.
   *
   * @param request - The incoming HTTP request.
   * @param env - Cloudflare environment bindings (DB, R2, DO, etc.).
   * @param _ctx - Execution context (unused, required by Cloudflare handler signature).
   * @returns The response from the DO or the vinext handler.
   */
  async fetch(request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Short-circuit known vulnerability-scanner probes with a cheap 404, skipping
    // the full vinext/React 404 render. See BLOCKED_PATHS for the (narrow) denylist.
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

      // Validate authentication before WebSocket upgrade
      // Extract session token from Cookie header
      const cookieHeader = request.headers.get("Cookie") || "";
      const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
      const sessionToken = sessionMatch?.[1];

      if (!sessionToken) {
        return new Response("Unauthorized: No session token", { status: 401 });
      }

      // Validate session using Better Auth
      const auth = await getAuth();
      // Create a Headers object with the Cookie for auth validation
      const headersForAuth = new Headers();
      headersForAuth.set("Cookie", cookieHeader);

      const session = await auth.api.getSession({ headers: headersForAuth });

      if (!session?.user?.id) {
        return new Response("Unauthorized: Invalid session", { status: 401 });
      }

      const userId = session.user.id;

      // Verify resume ownership via D1 query
      const { db } = getSessionDbForWebhook(env.CLICKFOLIO_DB);
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

      // Route to the Durable Object keyed by resumeId
      if (!env.CLICKFOLIO_STATUS_DO) {
        return new Response("WebSocket not available", { status: 503 });
      }

      const doId = env.CLICKFOLIO_STATUS_DO.idFromName(resumeId);
      const stub = env.CLICKFOLIO_STATUS_DO.get(doId);

      // Forward the WebSocket upgrade request to the DO with authenticated user header
      const modifiedRequest = new Request(request, {
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          "X-Authenticated-User-Id": userId,
        },
      });

      return stub.fetch(modifiedRequest);
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

  /**
   * Cloudflare Queue consumer handler.
   *
   * Processes messages from `clickfolio-parse-queue` and its dead-letter queue
   * (`clickfolio-parse-dlq`). Messages are validated against `queueMessageSchema`
   * and discarded if malformed. Retryable errors trigger a message retry; permanent
   * errors are acked so the message moves to the DLQ.
   *
   * @param batch - The message batch delivered by the queue binding.
   * @param env - Cloudflare environment bindings.
   */
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
        log("error", "queue message processing failed", {
          queue: batch.queue,
          error: String(error),
        });

        // Use error classification to determine retry strategy
        if (isRetryableError(error)) {
          message.retry();
        } else {
          // Permanent error - ack to send to DLQ
          log("error", "permanent error, sending to DLQ", { queue: batch.queue });
          message.ack();
        }
      }
    }
  },

  /**
   * Cloudflare Cron trigger handler.
   *
   * Calls shared cleanup functions directly to avoid self-fetch, which would
   * double billed Worker invocations.
   *
   * Supported triggers:
   * - `0 2 * * *` – R2 temp file cleanup (`performR2Cleanup`).
   * - `0 3 * * *` – DB cleanup (`performCleanup`).
   * - `0 4 * * *` – Disposable domain sync (`syncDisposableDomains`).
   * - `* /15 * * * *` (every 15 minutes) – Orphaned resume recovery (`recoverOrphanedResumes`).
   *
   * @param controller - The scheduled controller containing the cron expression.
   * @param env - Cloudflare environment bindings.
   */
  async scheduled(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
    const db = getDb(env.CLICKFOLIO_DB);

    try {
      switch (controller.cron) {
        case "0 2 * * *": {
          // Daily at 2 AM UTC - R2 temp file cleanup + pending deletion retry
          const r2Binding = env.CLICKFOLIO_R2_BUCKET;
          if (!r2Binding) {
            log("error", "CLICKFOLIO_R2_BUCKET not available for R2 cleanup", {
              cron: controller.cron,
            });
            return;
          }
          const result = await performR2Cleanup(r2Binding);
          log("info", "cron R2 cleanup completed", { cron: controller.cron, result });
          const pendingResult = await retryPendingR2Deletions(db, r2Binding);
          log("info", "cron pending deletions sweep completed", {
            cron: controller.cron,
            result: pendingResult,
          });
          break;
        }
        case "0 3 * * *": {
          const result = await performCleanup(db);
          log("info", "cron completed", { cron: controller.cron, result });
          break;
        }
        case "0 4 * * *": {
          const kv = env.CLICKFOLIO_DISPOSABLE_DOMAINS;
          if (!kv) {
            log("error", "CLICKFOLIO_DISPOSABLE_DOMAINS KV not available for domain sync", {
              cron: controller.cron,
            });
            return;
          }
          const syncResult = await syncDisposableDomains(kv);
          log("info", "cron completed", { cron: controller.cron, result: syncResult });
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
