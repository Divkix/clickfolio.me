/**
 * Promise-based WebSocket wrapper for wizard inline polling locations.
 *
 * Opens a WebSocket to the ResumeStatusDO, waits for a terminal status
 * (completed/failed), and resolves. Falls back to HTTP polling if the
 * WebSocket fails after WS_MAX_RECONNECT_ATTEMPTS reconnects.
 *
 * Transport mechanics (URL, keepalive pings, message decoding, reconnect
 * backoff) are shared with hooks/useResumeWebSocket.ts via
 * lib/realtime/socket.ts.
 */

import type { ResumeStatus } from "@/lib/db/schema/resume";
import { isValidResumeStatus, POLL_INTERVAL_MS } from "@/lib/realtime/constants";
import { createResumeStatusSocket, type ResumeStatusSocketHandle } from "@/lib/realtime/socket";

interface WaitResult {
  status: "completed" | "failed";
  error?: string;
}

/**
 * Wait for a resume to reach a terminal state (completed or failed).
 *
 * Tries WebSocket first for instant notification. If WS keeps failing after
 * WS_MAX_RECONNECT_ATTEMPTS, falls back to HTTP polling.
 *
 * @param resumeId - Resume ID to monitor
 * @param timeoutMs - Maximum time to wait (default 90s)
 * @returns Promise resolving to the terminal status
 */
export function waitForResumeCompletion(resumeId: string, timeoutMs = 90_000): Promise<WaitResult> {
  const { promise, resolve } = Promise.withResolvers<WaitResult>();

  let resolved = false;
  let socketHandle: ResumeStatusSocketHandle | null = null;
  let pollInterval: NodeJS.Timeout | null = null;
  let timeoutTimer: NodeJS.Timeout | null = null;

  function finish(result: WaitResult) {
    if (resolved) return;
    resolved = true;

    // Cleanup everything. "done" close reason is part of the contract with tests.
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

  // Overall timeout
  timeoutTimer = setTimeout(() => {
    finish({ status: "failed", error: "Timed out waiting for resume processing" });
  }, timeoutMs);

  // HTTP polling fallback
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
      } catch {
        // Ignore poll errors, will retry
      }
    };

    // Poll immediately, then on interval
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
    // Do NOT suppress on code 1000: the DO alarm closes with 1000 after
    // 30s and the terminal broadcast may have been missed; every close
    // (no onClose handler) falls through to reconnect/poll logic unless
    // already resolved (finish() detaches all handlers).
    onFallback: startPolling,
  });

  return promise;
}
