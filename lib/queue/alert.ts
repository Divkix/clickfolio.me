/**
 * Alert channels for permanently-failed resume parses.
 *
 * Shared by lib/queue/consumer.ts (non-retryable branch) and
 * lib/queue/dlq-consumer.ts so EVERY permanently-failed resume alerts exactly
 * once, no matter which path marked it failed.
 */

import { log } from "../utils/log";
import type { UnknownRecord } from "../types/json";

/**
 * Alert channels supported for queue-failure notifications
 */
export type AlertChannel = "logpush" | "webhook";

export interface DLQAlertPayload extends UnknownRecord {
  resumeId: string;
  userId: string;
  failureReason: string;
  errorType: string;
  totalAttempts: number;
  timestamp: string;
}

/**
 * Extended env type for optional alert configuration.
 * These env vars are only set in production via Cloudflare secrets.
 */
export interface AlertEnv {
  HYPERDRIVE: CloudflareEnv["HYPERDRIVE"];
  CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined;
  ALERT_WEBHOOK_URL?: string;
  ALERT_CHANNEL?: string;
}

/**
 * Resolve the alert channel from an environment string, defaulting to "logpush".
 */
export function getAlertChannel(channel: string | undefined): AlertChannel {
  return channel === "webhook" ? "webhook" : "logpush";
}

/**
 * Send alert for failed resume processing
 */
export async function sendAlert(
  payload: DLQAlertPayload,
  channel: AlertChannel,
  env: AlertEnv,
): Promise<void> {
  switch (channel) {
    case "logpush":
      log("error", "DLQ_ALERT", payload);
      break;

    case "webhook": {
      const webhookUrl = env.ALERT_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `Resume parsing permanently failed`,
              ...payload,
            }),
          });
        } catch (error) {
          log("error", "webhook alert failed", { error: String(error) });
        }
      }
      break;
    }
  }
}
