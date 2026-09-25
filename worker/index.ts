// eslint-disable-next-line typescript/triple-slash-reference -- required for Cloudflare Workers env types; import-style not supported here
/// <reference path="../lib/cloudflare-env.d.ts" />

import { eq } from "drizzle-orm";
import handler from "vinext/server/app-router-entry";
import { extractClerkTokenFromRequest, verifyClerkToken } from "../lib/auth/clerk";
import { performCleanup } from "../lib/cron/cleanup";
import { getDb } from "../lib/db";
import { resumes, user as userTable } from "../lib/db/schema";
import { log } from "../lib/utils/log";
// See issue #172 / ADR-0001.
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

export { ClickfolioStatusDO } from "../lib/durable-objects/resume-status";

export { R2DeleteWorkflow } from "../lib/workflows/r2-delete-workflow";

export { ResumeParseWorkflow } from "../lib/workflows/resume-parse-workflow";

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

    // A `.md` URL is a request for the Markdown twin of the page it names.
    // Static assets win: /pricing.md is a real file, not a twin of /pricing.
    const markdownPath = markdownSourcePath(url.pathname);

    if (markdownPath && (request.method === "GET" || request.method === "HEAD")) {
      const asset = await env.ASSETS.fetch(request);

      if (asset.status !== 404) return asset;

      const target = new URL(request.url);
      target.pathname = markdownPath;
      const appResponse = await handler.fetch(new Request(target, request));

      return markdownPageResponse(appResponse, request.url);
    }

    // Agents that explicitly ask for Markdown get a Markdown rendering of the
    // same SSR response. This must stay ahead of the HTML path so no cache or
    // header wrapper can serve HTML to a text/markdown client.
    if (prefersMarkdown(request.headers.get("accept"))) {
      return markdownPageResponse(await handler.fetch(request), request.url);
    }

    const response = await handler.fetch(request);
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

  async scheduled(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
    const db = getDb(env.HYPERDRIVE);

    try {
      switch (controller.cron) {
        case "0 3 * * *": {
          const result = await performCleanup(
            db,
            env.CLICKFOLIO_R2_BUCKET ?? null,
            env.CLICKFOLIO_R2_DELETE_WORKFLOW,
          );

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
