import { log } from "../utils/log";

type NotifyBody = { status: string; error?: string };
export async function notifyStatusChange({
  resumeId,
  status,
  error,
  env,
}: {
  resumeId: string;
  status: string;
  error?: string;
  env: { CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined };
}): Promise<void> {
  try {
    if (!env.CLICKFOLIO_STATUS_DO) {
      return;
    }

    const doId = env.CLICKFOLIO_STATUS_DO.idFromName(resumeId);
    const stub = env.CLICKFOLIO_STATUS_DO.get(doId);

    const body: NotifyBody = { status };
    if (error) {
      body.error = error;
    }

    await stub.fetch("https://do-internal/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    log("error", "notify-status: failed to notify DO for resume", { resumeId, error: String(err) });
  }
}

export async function notifyStatusChangeBatch(
  resumeIds: string[],
  status: string,
  env: { CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined },
): Promise<void> {
  await Promise.allSettled(
    resumeIds.map((resumeId) => notifyStatusChange({ resumeId, status, env })),
  );
}
