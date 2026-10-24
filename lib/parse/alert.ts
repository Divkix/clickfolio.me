import { Cause, Effect, Exit } from "effect";
import { runBackground } from "../effect/edges";
import { upstreamLogFields } from "../effect/failure-fields";
import { AlertWebhook } from "../effect/services/alert-webhook";
import { errorFields } from "../utils/error-fields";
import { log } from "../utils/log";
import type { UnknownRecord } from "../types/json";

export type AlertChannel = "logpush" | "webhook";

export interface ParseFailureAlert extends UnknownRecord {
  resumeId: string;
  userId: string;
  failureReason: string;
  errorType: string;
  totalAttempts: number;
  timestamp: string;
}

export interface AlertEnv {
  HYPERDRIVE: CloudflareEnv["HYPERDRIVE"];
  CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined;
  ALERT_WEBHOOK_URL?: string;
  ALERT_CHANNEL?: string;
}

export function getAlertChannel(channel: string | undefined): AlertChannel {
  return channel === "webhook" ? "webhook" : "logpush";
}

/**
 * Raises a permanent parse failure on the chosen channel. `logpush` is a log line; `webhook`
 * POSTs once, without retry, and fails with `HttpUpstreamFailed` (the URL is already stripped
 * from it, since the URL is the webhook's secret).
 */
export function parseFailureAlert(payload: ParseFailureAlert, channel: AlertChannel) {
  if (channel === "logpush") return Effect.sync(() => log("error", "PARSE_FAILURE_ALERT", payload));

  return AlertWebhook.use((webhook) =>
    webhook.post({ text: "Resume parsing permanently failed", ...payload }),
  );
}

/** `parseFailureAlert` for callers that must not fail because of it: logs the failure and drops it. */
export function parseFailureAlertBestEffort(payload: ParseFailureAlert, channel: AlertChannel) {
  return parseFailureAlert(payload, channel).pipe(
    Effect.catchTag("HttpUpstreamFailed", (failure) =>
      Effect.sync(() => log("error", "webhook alert failed", upstreamLogFields(failure))),
    ),
  );
}

export async function sendAlert(
  payload: ParseFailureAlert,
  channel: AlertChannel,
  env: AlertEnv,
): Promise<void> {
  const exit = await runBackground(
    parseFailureAlertBestEffort(payload, channel),
    AlertWebhook.layer(env),
  );

  // Typed failures were logged above; what reaches here is a defect.
  if (Exit.isFailure(exit)) {
    log("error", "webhook alert failed", errorFields(Cause.squash(exit.cause)));
  }
}
