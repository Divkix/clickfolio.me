/**
 * Promise-based WebSocket wrapper for wizard inline polling locations.
 *
 * Opens a WebSocket to the ResumeStatusDO, waits for a terminal status
 * (completed/failed), and resolves. Falls back to HTTP polling if the
 * WebSocket fails to connect after 3 attempts.
 */

interface WaitResult {
  status: "completed" | "failed";
  error?: string;
}

const MAX_WS_CONNECT_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 3000;
const PING_INTERVAL_MS = 30000;

/**
 * Wait for a resume to reach a terminal state (completed or failed).
 *
 * Tries WebSocket first for instant notification. If WS fails to connect
 * after MAX_WS_CONNECT_ATTEMPTS, falls back to HTTP polling.
 *
 * @param resumeId - Resume ID to monitor
 * @param timeoutMs - Maximum time to wait (default 90s)
 * @returns Promise resolving to the terminal status
 */
export function waitForResumeCompletion(resumeId: string, timeoutMs = 90_000): Promise<WaitResult> {
  return new Promise((resolve) => {
    let resolved = false;
    let ws: WebSocket | null = null;
    let wsAttempts = 0;
    let pollInterval: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    function finish(result: WaitResult) {
      if (resolved) return;
      resolved = true;

      // Cleanup everything
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.onopen = null;
        ws.close(1000, "done");
        ws = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
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

          const data = (await response.json()) as {
            status: string;
            error?: string | null;
          };

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
      poll();
      pollInterval = setInterval(poll, POLL_INTERVAL_MS);
    }

    // Try WebSocket first
    function connectWS() {
      if (resolved) return;

      wsAttempts++;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/resume-status?resume_id=${resumeId}`;

      ws = new WebSocket(url);

      ws.onopen = () => {
        // Start ping keepalive
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string" || event.data === "pong") return;

        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            status: string;
            error?: string;
          };

          if (msg.type === "status") {
            if (msg.status === "completed") {
              finish({ status: "completed" });
            } else if (msg.status === "failed") {
              finish({ status: "failed", error: msg.error });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        if (resolved || event.code === 1000) return;

        // Retry WS or fall back to polling
        if (wsAttempts < MAX_WS_CONNECT_ATTEMPTS) {
          const delay = 1000 * 2 ** (wsAttempts - 1);
          setTimeout(connectWS, delay);
        } else {
          startPolling();
        }
      };

      ws.onerror = () => {
        // onclose handles retry logic
      };
    }

    connectWS();
  });
}
