import type { ResumeStatus } from "@/lib/db/schema/resume";
import { isValidResumeStatus, POLL_INTERVAL_MS } from "@/lib/realtime/constants";
import { createResumeStatusSocket, type ResumeStatusSocketHandle } from "@/lib/realtime/socket";

interface WaitResult {
  status: "completed" | "failed";
  error?: string;
}

export function waitForResumeCompletion(resumeId: string, timeoutMs = 90_000): Promise<WaitResult> {
  const { promise, resolve } = Promise.withResolvers<WaitResult>();

  let resolved = false;
  let socketHandle: ResumeStatusSocketHandle | null = null;
  let pollInterval: NodeJS.Timeout | null = null;
  let timeoutTimer: NodeJS.Timeout | null = null;

  function finish(result: WaitResult) {
    if (resolved) return;
    resolved = true;

    if (socketHandle) {
      socketHandle.dispose("done");
      socketHandle = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }

    resolve(result);
  }

  timeoutTimer = setTimeout(() => {
    finish({ status: "failed", error: "Timed out waiting for resume processing" });
  }, timeoutMs);

  function startPolling() {
    const poll = async () => {
      if (resolved) return;
      try {
        const response = await fetch(`/api/resume/status?resume_id=${resumeId}`);
        if (!response.ok) return;

        // SAFETY: HTTP status payload validated immediately after via isValidResumeStatus; cast narrows json shape with early return on invalid status
        const data = (await response.json()) as {
          status: ResumeStatus;
          error?: string | null;
        };
        if (!isValidResumeStatus(data.status)) return;

        if (data.status === "completed") {
          finish({ status: "completed" });
        } else if (data.status === "failed") {
          finish({ status: "failed", error: data.error ?? undefined });
        }
      } catch {}
    };

    void poll();
    pollInterval = setInterval(poll, POLL_INTERVAL_MS);
  }

  socketHandle = createResumeStatusSocket(resumeId, {
    onMessage: (msg) => {
      if (msg.type !== "status") return;
      if (msg.status === "completed") {
        finish({ status: "completed" });
      } else if (msg.status === "failed") {
        finish({ status: "failed", error: msg.error });
      }
    },
    onFallback: startPolling,
  });

  return promise;
}
