// eslint-disable-next-line typescript/triple-slash-reference -- required for Cloudflare Workers env types; import-style not supported here
/// <reference path="../lib/cloudflare-env.d.ts" />

import handler from "vinext/server/app-router-entry";
import { processEdgePurgeBatch } from "../lib/cache/edge-purge";
import { performCleanup } from "../lib/cron/cleanup";
import { performStrandedSweep } from "../lib/cron/stranded-resumes";
import { CachePurge } from "../lib/effect/services/cache-purge";
import { log } from "../lib/utils/log";
import { errorFields } from "../lib/utils/error-fields";
// See issue #172.
import { SECURITY_HEADERS } from "../lib/utils/security-headers";
import {
  appendLinkEntry,
  appendVary,
  isHtmlResponse,
  markdownResponse,
  markdownSourcePath,
  pageLinkHeader,
  prefersMarkdown,
} from "../lib/worker/markdown-negotiation";
import { handleOtelProxy, isOtelProxyPath } from "../lib/worker/otel-proxy";
import { handleResumeStatusSocket } from "../lib/worker/resume-status-socket";
import {
  encodedProfileRedirect,
  withoutProfileCredentials,
} from "../lib/worker/shared-cache-request";

export { ClickfolioStatusDO } from "../lib/durable-objects/resume-status";

export { R2DeleteWorkflow } from "../lib/workflows/r2-delete-workflow";

export { ResumeParseWorkflow } from "../lib/workflows/resume-parse-workflow";

// vinext's Workers Cache entrypoints. The build adds these exports itself; naming
// them here types `ctx.exports.VinextCachedResponse` for the purge consumer.
export {
  VinextCachedResponse,
  VinextUncachedResponse,
} from "@vinext/cloudflare/cache/cdn-adapter.worker";

const BLOCKED_PATHS =
  /(?:\.php$|^\/\.env|^\/\.git\/|^\/\.aws\/|^\/wp-|^\/xmlrpc\.php$|(?:^|\/)adminer(?:\/|$)|^\/config\.json$|application\.ya?ml$)/i;

/** Adds the security headers, and renders the Markdown representation when the page is HTML. */
async function markdownPageResponse(response: Response, url: string): Promise<Response> {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  if (!isHtmlResponse(response)) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return markdownResponse({
    response: new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
    html: await response.text(),
    url,
  });
}

export default {
  async fetch(incoming: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(incoming.url);
    // Profile pages are shared-cached: render them without the visitor's session.
    const request = withoutProfileCredentials(incoming, url.pathname);

    if (BLOCKED_PATHS.test(url.pathname)) {
      return new Response("Not Found", { status: 404, headers: SECURITY_HEADERS });
    }

    const canonical = encodedProfileRedirect(url);

    if (canonical) return canonical;

    if (isOtelProxyPath(url.pathname)) {
      return handleOtelProxy(request, env, ctx);
    }

    // WebSocket upgrades for resume status are answered here, before vinext: Next.js route
    // handlers have no WebSocket API, so the app has no route for them.
    if (
      url.pathname === "/ws/resume-status" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      return handleResumeStatusSocket(request, env);
    }

    // A `.md` URL is a request for the Markdown twin of the page it names.
    // Static assets win: /pricing.md is a real file, not a twin of /pricing.
    const markdownPath = markdownSourcePath(url.pathname);

    if (markdownPath && (request.method === "GET" || request.method === "HEAD")) {
      const asset = await env.ASSETS.fetch(request);

      if (asset.status !== 404) return asset;

      const target = new URL(request.url);
      target.pathname = markdownPath;
      const appResponse = await handler.fetch(new Request(target, request), env, ctx);

      return markdownPageResponse(appResponse, request.url);
    }

    // Agents that explicitly ask for Markdown get a Markdown rendering of the
    // same SSR response. This must stay ahead of the HTML path so no cache or
    // header wrapper can serve HTML to a text/markdown client.
    if (prefersMarkdown(request.headers.get("accept"))) {
      return markdownPageResponse(await handler.fetch(request, env, ctx), request.url);
    }

    // env + ctx let vinext run the request inside its execution context, so
    // cache writes are registered with ctx.waitUntil instead of being cut off
    // with the response.
    const response = await handler.fetch(request, env, ctx);
    const newHeaders = new Headers(response.headers);

    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(key, value);
    }

    // Keeps shared caches from serving the HTML representation to a client that
    // asked for Markdown (and vice versa), and points agents at the sitemap and
    // the Markdown twin before they parse the page.
    if (isHtmlResponse(response)) {
      appendVary(newHeaders, "Accept");
      appendLinkEntry(newHeaders, pageLinkHeader(url.pathname));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },

  // Edge purge consumer (lib/cache/edge-purge.ts). A purge only reaches the
  // entrypoint that sends it, so it goes through the cached response entrypoint.
  // https://developers.cloudflare.com/workers/cache/purge/
  async queue(batch: MessageBatch, _env: CloudflareEnv, ctx: ExecutionContext): Promise<void> {
    await processEdgePurgeBatch(batch, CachePurge.layer(ctx));
  },

  async scheduled(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
    try {
      switch (controller.cron) {
        case "0 3 * * *": {
          // Logs its own cleanup_completed / cleanup_failed event; builds its own layers.
          await performCleanup(env);
          break;
        }

        case "*/15 * * * *": {
          // Fails resumes stuck in queued/processing; builds its own layers. A rejection
          // lands in the catch below, so the run is recorded as failed.
          await performStrandedSweep(env);
          break;
        }

        default:
          log("error", "unknown cron trigger", { cron: controller.cron });
      }
    } catch (error) {
      log("error", "cron error", { cron: controller.cron, ...errorFields(error) });
      // Rethrow so the run is recorded as failed, not `ok`. Cleanup only deletes
      // expired rows, so a platform retry (if any) is harmless.
      throw error;
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
