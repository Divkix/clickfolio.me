/**
 * Best-effort notification helper for pushing resume status changes
 * to the ResumeStatusDO Durable Object.
 *
 * Used by both the main queue consumer and DLQ consumer.
 * Failures are logged but never thrown — polling fallback covers missed notifications.
 */

/**
 * Notify a single resume's Durable Object of a status change.
 * Best-effort: logs errors but does not throw.
 */
export async function notifyStatusChange({
  resumeId,
  status,
  error,
  env,
}: {
  resumeId: string;
  status: string;
  error?: string;
  env: CloudflareEnv;
}): Promise<void> {
  try {
    if (!env.RESUME_STATUS_DO) {
      // DO binding not configured (e.g., local dev without DO support)
      return;
    }

    const doId = env.RESUME_STATUS_DO.idFromName(resumeId);
    const stub = env.RESUME_STATUS_DO.get(doId);

    const body: { status: string; error?: string } = { status };
    if (error) {
      body.error = error;
    }

    await stub.fetch("https://do-internal/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Best-effort: log but don't throw. Polling fallback covers this.
    console.error(`[notify-status] Failed to notify DO for resume ${resumeId}:`, err);
  }
}

/**
 * Notify multiple resume Durable Objects of a status change.
 * Used for fan-out when multiple resumes were waiting_for_cache.
 */
export async function notifyStatusChangeBatch(
  resumeIds: string[],
  status: string,
  env: CloudflareEnv,
): Promise<void> {
  await Promise.allSettled(
    resumeIds.map((resumeId) => notifyStatusChange({ resumeId, status, env })),
  );
}
