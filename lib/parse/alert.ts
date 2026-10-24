import { log } from "../utils/log";
import { errorFields } from "../utils/error-fields";
import type { UnknownRecord } from "../types/json";

// The webhook is best-effort and runs in its own at-most-once step; a hung receiver must not hold it.
const WEBHOOK_TIMEOUT_MS = 5_000;

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

export async function sendAlert(
  payload: ParseFailureAlert,
  channel: AlertChannel,
  env: AlertEnv,
): Promise<void> {
  switch (channel) {
    case "logpush":
      log("error", "PARSE_FAILURE_ALERT", payload);
      break;

    case "webhook": {
      const webhookUrl = env.ALERT_WEBHOOK_URL;

      if (webhookUrl) {
        try {
          const response = await fetch(webhookUrl, {
            method: "POST",
            // A hung webhook must not outlive the workflow step that sent it.
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `Resume parsing permanently failed`,
              ...payload,
            }),
          });

          // The URL carries the webhook's secret, so only the status is logged.
          if (!response.ok) {
            log("error", "webhook alert rejected", { status: response.status });
          }
        } catch (error) {
          const fields = errorFields(error);

          // Fetch errors can quote the URL, which carries the webhook's secret.
          log("error", "webhook alert failed", {
            ...fields,
            "error.message": fields["error.message"].replaceAll(webhookUrl, "[webhook]"),
            stack: fields.stack?.replaceAll(webhookUrl, "[webhook]"),
          });
        }
      }

      break;
    }
  }
}
