import { Effect } from "effect";
import { upstreamLogFields } from "../effect/failure-fields";
import { AlertWebhook } from "../effect/services/alert-webhook";
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
