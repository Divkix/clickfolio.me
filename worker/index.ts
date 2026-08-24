/**
 * Custom worker entry point that wraps vinext's generated handler
 * and adds Cloudflare Queue consumer support and Durable Object exports.
 */
// eslint-disable-next-line typescript/triple-slash-reference -- required for Cloudflare Workers env types; import-style not supported here
/// <reference path="../lib/cloudflare-env.d.ts" />

import { eq } from "drizzle-orm";
import handler from "vinext/server/app-router-entry";
// Import Clerk session verification for WebSocket auth
import { extractClerkTokenFromRequest, verifyClerkToken } from "../lib/auth/clerk";
import { performCleanup } from "../lib/cron/cleanup";
import { performR2Cleanup, retryPendingR2Deletions } from "../lib/cron/cleanup-r2";
import { recoverOrphanedResumes } from "../lib/cron/recover-orphaned";
import { syncDisposableDomains } from "../lib/cron/sync-disposable-domains";
import { getDb } from "../lib/db";
import { resumes, user as userTable } from "../lib/db/schema";
import { INFRA } from "@/lib/resume/lifecycle";
import { handleQueueMessage } from "../lib/queue/consumer";
import { handleDLQMessage } from "../lib/queue/dlq-consumer";
import { isRetryableError, type QueueErrorInput } from "../lib/queue/errors";
import { queueMessageSchema } from "../lib/queue/types";
import { log } from "../lib/utils/log";
// Single source of truth for security headers, shared with the API response
// toolkit (createSuccessResponse/createErrorResponse). The worker applies it to
// every response as the catch-all for page routes that never pass through the
// API toolkit; because it is the same object, "applied last" equals "applied
// first" and the two layers can no longer drift. See issue #172 / ADR-0001.
import { SECURITY_HEADERS } from "../lib/utils/security-headers";

/** Re-exported Durable Object for WebSocket resume status updates. */
export { ClickfolioStatusDO } from "../lib/durable-objects/resume-status";

/**
 * Vulnerability-scanner probe paths (WordPress, exposed secrets, DB admin tools).
 * These never map to a real app route, so we 404 them at the edge of the worker
 * instead of running the full vinext/React 404 render — saving CPU on the high
 * volume of automated scanner traffic. Compiled once per isolate.
 *
 * Kept deliberately narrow so legitimate routes (`/@handle`, `/for/*`, `/api/*`,
 * `/blog/*`) can never match. `xmlrpc`/`adminer` are anchored path segments (not
 * bare substrings) so a user handle like `@xmlrpc` is never 404'd; both tokens
 * are also in RESERVED_HANDLES to block new registrations.
 */
const BLOCKED_PATHS =
  /(?:\.php$|^\/\.env|^\/\.git\/|^\/\.aws\/|^\/wp-|^\/xmlrpc\.php$|(?:^|\/)adminer(?:\/|$)|^\/config\.json$|application\.ya?ml$)/i;

export default {
  /**
   * Main request handler. Routes WebSocket upgrade requests to the
   * `ClickfolioStatusDO` Durable Object and all other requests to the vinext
   * app-router handler.
   *
   * WebSocket flow:
   * 3. Validate the Clerk `__session` JWT (JWKS verify) and map the Clerk id
   *    to the local Postgres user row via `user.clerk_id`.
   * 4. Verify the user owns the resume via Postgres.
   * 5. Forward the request to the DO keyed by `resumeId`.
   *
   * @param request - The incoming HTTP request.
   * @param env - Cloudflare environment bindings (Hyperdrive PG, R2, Queue, DO, etc.).
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

      // Validate authentication before WebSocket upgrade.
      // Extract and cryptographically verify the Clerk session JWT from the
      // `__session` cookie (or Authorization bearer header), then map it to
      // the local user row via the clerk_id backfill column.
      const token = extractClerkTokenFromRequest(request);
      const claims = token ? await verifyClerkToken(token) : null;

      if (!claims?.sub) {
        return new Response("Unauthorized: Invalid session", { status: 401 });
      }

      // Map the Clerk identity to the local Postgres user row, then verify
      // resume ownership via Postgres query.
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

      // Route to the Durable Object keyed by resumeId
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
   * errors are acked, which DISCARDS the message — per Cloudflare Queues semantics
   * only retry-exhausted messages are ever delivered to the DLQ. The consumer marks
   * the resume failed and sends the alert itself before rethrowing.
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
    const db = getDb(env.HYPERDRIVE);

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
          // Run the two independent sweeps concurrently so a slow temp-cleanup
          // does not delay the GDPR pending-deletion retry (and vice versa).
          // Each settles independently; a failure in one is logged but never
          // skips the other.
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
