import { eq } from "drizzle-orm";
import { resumes } from "../db/schema";
import { getSessionDbForWebhook } from "../db/session";
import { QueueErrorType } from "./errors";
import { notifyStatusChange } from "./notify-status";
import type { DeadLetterMessage, QueueMessage } from "./types";

/**
 * Alert channels supported for DLQ notifications
 */
type AlertChannel = "logpush" | "webhook" | "email";

interface DLQAlertPayload {
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
interface AlertEnv extends CloudflareEnv {
  ALERT_WEBHOOK_URL?: string;
  ALERT_CHANNEL?: AlertChannel;
}

/**
 * Send alert for failed resume processing
 */
async function sendAlert(
  payload: DLQAlertPayload,
  channel: AlertChannel,
  env: AlertEnv,
): Promise<void> {
  switch (channel) {
    case "logpush":
      // Structured log for Cloudflare Logpush integration
      console.error("[DLQ_ALERT]", JSON.stringify(payload));
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
          console.error("Webhook alert failed:", error);
        }
      }
      break;
    }

    case "email":
      // Email alerting would require an email service integration
      // For now, fall back to logpush
      console.error("[DLQ_ALERT_EMAIL]", JSON.stringify(payload));
      break;
  }
}

/**
 * Handle a dead letter queue message
 *
 * This function is called when a message has exhausted all retries
 * and been moved to the DLQ. It:
 * 1. Updates the resume status to permanently failed
 * 2. Sends an alert via configured channel
 */
export async function handleDLQMessage(
  message: QueueMessage | DeadLetterMessage,
  env: CloudflareEnv,
): Promise<void> {
  // Extract the original message if wrapped in DeadLetterMessage
  const originalMessage = "originalMessage" in message ? message.originalMessage : message;
  const failureReason =
    "failureReason" in message ? message.failureReason : "Unknown (moved to DLQ)";

  // Use webhook variant since cookies are not available in Worker queue context
  const { db } = getSessionDbForWebhook(env.DB);

  // Fetch current resume state
  const currentResume = await db
    .select({
      status: resumes.status,
      totalAttempts: resumes.totalAttempts,
      lastAttemptError: resumes.lastAttemptError,
    })
    .from(resumes)
    .where(eq(resumes.id, originalMessage.resumeId))
    .limit(1);

  // Parse last attempt error if available
  let errorType = QueueErrorType.UNKNOWN;
  try {
    if (currentResume[0]?.lastAttemptError) {
      const parsed = JSON.parse(currentResume[0].lastAttemptError);
      errorType = parsed.type || QueueErrorType.UNKNOWN;
    }
  } catch {
    // Ignore parse errors
  }

  // Build error message
  const attemptCount = currentResume[0]?.totalAttempts || "unknown";
  const errorMsg = `Permanently failed after ${attemptCount} attempts: ${failureReason}`;

  // Update resume to permanently failed
  await db
    .update(resumes)
    .set({
      status: "failed",
      errorMessage: errorMsg,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(resumes.id, originalMessage.resumeId));

  // Notify connected WebSocket clients of permanent failure
  await notifyStatusChange({
    resumeId: originalMessage.resumeId,
    status: "failed",
    error: errorMsg,
    env,
  });

  // Cast env to AlertEnv for optional alert properties
  const alertEnv = env as AlertEnv;
  const alertChannel = alertEnv.ALERT_CHANNEL || "logpush";

  // Send alert
  const alertPayload: DLQAlertPayload = {
    resumeId: originalMessage.resumeId,
    userId: originalMessage.userId,
    failureReason,
    errorType,
    totalAttempts: currentResume[0]?.totalAttempts ?? 0,
    timestamp: new Date().toISOString(),
  };

  await sendAlert(alertPayload, alertChannel, alertEnv);

  console.log(`DLQ: Marked resume ${originalMessage.resumeId} as permanently failed`);
}
