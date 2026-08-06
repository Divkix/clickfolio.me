import { eq } from "drizzle-orm";
import { resumes } from "../db/schema";
import { getSessionDbForWebhook } from "../db/session";
import { getAlertChannel, sendAlert, type AlertEnv } from "./alert";
import { QueueErrorType } from "./errors";
import { notifyStatusChange } from "./notify-status";
import type { DeadLetterMessage, QueueMessage } from "./types";
import { log } from "../utils/log";

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
  env: {
    CLICKFOLIO_DB: CloudflareEnv["CLICKFOLIO_DB"];
    CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined;
  },
): Promise<void> {
  // Extract the original message if wrapped in DeadLetterMessage
  const originalMessage = "originalMessage" in message ? message.originalMessage : message;
  const failureReason =
    "failureReason" in message ? message.failureReason : "Unknown (moved to DLQ)";

  // Use webhook variant since cookies are not available in Worker queue context
  const { db } = getSessionDbForWebhook(env.CLICKFOLIO_DB);

  // Fetch current resume state
  const currentResume = await db
    .select({
      status: resumes.status,
      totalAttempts: resumes.totalAttempts,
      lastAttemptError: resumes.lastAttemptError,
      errorMessage: resumes.errorMessage,
    })
    .from(resumes)
    .where(eq(resumes.id, originalMessage.resumeId))
    .limit(1);

  // Do not clobber a resume that already completed via a concurrent path
  // (waiting-for-cache fan-out, cache hit, or orphan-recovery re-queue).
  if (currentResume[0]?.status === "completed") {
    log("info", "DLQ: resume already completed, skipping failure mark", {
      resumeId: originalMessage.resumeId,
    });
    return;
  }

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

  // Preserve the existing user-friendly errorMessage when one is already stored
  // (the consumer writes it via getUserFriendlyError when parsing fails); only
  // synthesize the "Permanently failed after N attempts" message when the row
  // has no friendly message yet. This stops the DLQ from clobbering the
  // specific, actionable error the user already saw.
  const attemptCount = currentResume[0]?.totalAttempts || "unknown";
  const errorMsg =
    currentResume[0]?.errorMessage ??
    `Permanently failed after ${attemptCount} attempts: ${failureReason}`;

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
  const alertChannel = getAlertChannel(alertEnv.ALERT_CHANNEL);

  // Send alert (shared with the main consumer's non-retryable branch)
  await sendAlert(
    {
      resumeId: originalMessage.resumeId,
      userId: originalMessage.userId,
      failureReason,
      errorType,
      totalAttempts: currentResume[0]?.totalAttempts ?? 0,
      timestamp: new Date().toISOString(),
    },
    alertChannel,
    alertEnv,
  );

  log("info", "DLQ: marked resume as permanently failed", { resumeId: originalMessage.resumeId });
}
