import { Context, Effect, Layer } from "effect";
import type { UnknownRecord } from "@/lib/types/json";
import { errorFields } from "@/lib/utils/error-fields";
import { externalCall } from "../external";
import { HttpUpstreamFailed, type UpstreamDetails } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

/** The part of `fetch` this service uses; tests pass a fake. */
export type WebhookFetch = (url: string, init: RequestInit) => Promise<Response>;

type AlertWebhookService = {
  /**
   * One POST, never retried: a timed-out request may still have been delivered, and a retry
   * would page twice. Succeeds without sending when no webhook URL is configured.
   */
  readonly post: (body: UnknownRecord) => Effect.Effect<void, HttpUpstreamFailed>;
};

/** A non-2xx answer. `status` lets `classifyUpstreamCause` tell a rejection from an outage. */
class WebhookStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`alert webhook answered ${status}`);
    this.name = "WebhookStatusError";
    this.status = status;
  }
}

/** The URL is the webhook's credential, and fetch errors can quote it: strip it from everything kept. */
function redactor(webhookUrl: string): (text: string) => string {
  const secrets = [webhookUrl];

  // Providers put the token in the path, which fetch errors may quote without the host.
  if (URL.canParse(webhookUrl)) {
    const { pathname } = new URL(webhookUrl);

    if (pathname.length > 1) secrets.push(pathname);
  }

  return (text) => secrets.reduce((clean, secret) => clean.replaceAll(secret, "[webhook]"), text);
}

function scrubbedCause(cause: unknown, redact: (text: string) => string): Error {
  const fields = errorFields(cause);
  const scrubbed = new Error(redact(fields["error.message"]));
  scrubbed.name = fields["error.name"];
  scrubbed.stack = fields.stack ? redact(fields.stack) : undefined;

  return scrubbed;
}

function service(
  webhookUrl: string | undefined,
  send: WebhookFetch,
  timeoutMs: number,
): AlertWebhookService {
  if (!webhookUrl) return { post: () => Effect.void };

  const redact = redactor(webhookUrl);

  function fail(details: UpstreamDetails): HttpUpstreamFailed {
    return new HttpUpstreamFailed({
      operation: details.operation,
      kind: details.kind,
      message: redact(details.message),
      cause: details.cause === undefined ? undefined : scrubbedCause(details.cause, redact),
      host: "alert-webhook",
    });
  }

  return {
    post: (body) =>
      externalCall({
        operation: "alert.webhook",
        timeoutMs,
        run: async (signal) => {
          const response = await send(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
          });

          if (!response.ok) throw new WebhookStatusError(response.status);
        },
        fail,
      }),
  };
}

/** The ops alert webhook (Slack-style JSON POST). */
export class AlertWebhook extends Context.Service<AlertWebhook, AlertWebhookService>()(
  "clickfolio/AlertWebhook",
) {
  static layer(env: { readonly ALERT_WEBHOOK_URL?: string }): Layer.Layer<AlertWebhook> {
    return Layer.succeed(
      AlertWebhook,
      service(env.ALERT_WEBHOOK_URL, (url, init) => fetch(url, init), TIMEOUT_MS.upstream),
    );
  }

  /** For tests: a fake `fetch` and, optionally, a shorter time limit. */
  static layerFrom(
    webhookUrl: string | undefined,
    send: WebhookFetch,
    timeoutMs: number = TIMEOUT_MS.upstream,
  ): Layer.Layer<AlertWebhook> {
    return Layer.succeed(AlertWebhook, service(webhookUrl, send, timeoutMs));
  }
}
