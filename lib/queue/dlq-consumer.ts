import { eq } from "drizzle-orm";
import { resumes } from "../db/schema";
import { getDb } from "../db";
import { getLastAttemptErrorType } from "../resume/lifecycle";
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
    HYPERDRIVE: CloudflareEnv["HYPERDRIVE"];
    CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined;
  },
): Promise<void> {
  // Extract the original message if wrapped in DeadLetterMessage
  const originalMessage = "originalMessage" in message ? message.originalMessage : message;
  const failureReason =
    "failureReason" in message ? message.failureReason : "Unknown (moved to DLQ)";

  // Queue consumers run without request/cookie scope; open the shared Hyperdrive pool directly.
  const db = getDb(env.HYPERDRIVE);

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

  // Skip if the resume no longer exists (account deletion cascades `resumes`).
  // Without this guard the DLQ would synthesize a failed state + alert for a deleted row.
  if (!currentResume.length) {
    log("info", "DLQ: resume not found, skipping", {
      resumeId: originalMessage.resumeId,
    });
    return;
  }

  // Do not clobber a resume that already completed via a concurrent path
  // (waiting-for-cache fan-out, cache hit, or orphan-recovery re-queue).
  if (currentResume[0]?.status === "completed") {
    log("info", "DLQ: resume already completed, skipping failure mark", {
      resumeId: originalMessage.resumeId,
    });
    return;
  }

  // Parse last attempt error if available (shape owned by lifecycle).
  // Validate against the known enum so an arbitrary stored string does not leak through as `errorType`.
  // SAFETY: stored lastAttemptError is QueueError JSON from classifyQueueError().toJSON(); lifecycle.parseLastAttemptError validates shape, cast narrows nullable string.
  const rawErrorType = getLastAttemptErrorType(
    (currentResume[0]?.lastAttemptError as string | null) ?? null,
  );
  // SAFETY: QueueErrorType enum values are strings; cast to string[] for includes check and back to QueueErrorType is safe widening/narrowing within enum.
  const errorType =
    rawErrorType !== null && (Object.values(QueueErrorType) as string[]).includes(rawErrorType)
      ? (rawErrorType as QueueErrorType)
      : QueueErrorType.UNKNOWN;

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
  // SAFETY: env is CloudflareEnv with optional AlertEnv fields; cast narrows to AlertEnv for alert channel access, fallback via getAlertChannel.
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
