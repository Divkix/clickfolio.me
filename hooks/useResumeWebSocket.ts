"use client";

import { z } from "zod";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import {
  getReconnectDelay,
  isValidResumeStatus,
  shouldRetry,
  WS_PING_INTERVAL_MS,
} from "@/lib/realtime/constants";
type ConnectionState = "connecting" | "connected" | "reconnecting" | "fallback" | "closed";

// @ts-ignore TS6196 — StatusMessage documents WebSocket payload shape; kept for type clarity
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- StatusMessage documents WebSocket payload shape; kept for type clarity
interface StatusMessage {
  type: "status";
  status: ResumeStatus;
  error?: string;
  timestamp: string;
}

interface UseResumeWebSocketOptions {
  /** Resume ID to subscribe to. null disables the connection. */
  resumeId: string | null;
  /** Called when a status update arrives via WebSocket. */
  onStatusChange: (status: ResumeStatus, error?: string) => void;
  /** Disable WebSocket and force polling fallback (e.g., for testing). */
  disabled?: boolean;
}

interface UseResumeWebSocketReturn {
  /** Current WebSocket connection state. */
  connectionState: ConnectionState;
  /** Manually close the WebSocket connection. */
  close: () => void;
}

/**
 * WebSocket hook for real-time resume status updates.
 *
 * Opens a WebSocket to /ws/resume-status, receives push notifications
 * from the ClickfolioStatusDO Durable Object, and auto-reconnects with
 * exponential backoff. Falls back to `connectionState: "fallback"` after
 * MAX_RECONNECT_ATTEMPTS failures so callers can activate HTTP polling.
 */
export function useResumeWebSocket({
  resumeId,
  onStatusChange,
  disabled = false,
}: UseResumeWebSocketOptions): UseResumeWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("closed");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const closedManuallyRef = useRef(false);
  const lastStatusRef = useRef<ResumeStatus | null>(null);

  // Keep callback ref up to date without re-triggering effect
  onStatusChangeRef.current = onStatusChange;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "cleanup");
      wsRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    closedManuallyRef.current = true;
    cleanup();
    setConnectionState("closed");
  }, [cleanup]);

  useEffect(() => {
    if (!resumeId || disabled) {
      cleanup();
      setConnectionState("closed");
      return;
    }

    closedManuallyRef.current = false;
    reconnectAttemptRef.current = 0;

    function connect() {
      if (closedManuallyRef.current) return;

      // Build WebSocket URL from current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/resume-status?resume_id=${resumeId}`;

      setConnectionState(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionState("connected");

        // Start ping keepalive
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, WS_PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (!z.string().safeParse(event.data).success) return;
        if (event.data === "pong") return;
        try {
          // SAFETY: WebSocket message validated via isValidResumeStatus guard immediately after; cast provides typed access with early return on invalid status
          const msg = JSON.parse(event.data) as {
            type: string;
            status: ResumeStatus;
            error?: string;
          };
          if (msg.type === "status") {
            if (!isValidResumeStatus(msg.status)) return;
            lastStatusRef.current = msg.status;
            onStatusChangeRef.current(msg.status, msg.error);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        wsRef.current = null;

        // Manually closed — do not reconnect
        if (closedManuallyRef.current) {
          setConnectionState("closed");
          return;
        }

        // Server alarm closes with 1000 after 30s (see ClickfolioStatusDO.alarm).
        // Treat 1000 as terminal only when we already received a terminal status;
        // otherwise it would dead-lock the client if the broadcast was missed.
        if (event.code === 1000) {
          const isTerminal =
            lastStatusRef.current === "completed" || lastStatusRef.current === "failed";
          if (isTerminal) {
            setConnectionState("closed");
            return;
          }
          // Non-terminal 1000: fall through to reconnect/fallback
        }

        // Attempt reconnect with exponential backoff (+ jitter via getReconnectDelay)
        reconnectAttemptRef.current++;
        if (!shouldRetry(reconnectAttemptRef.current)) {
          setConnectionState("fallback");
          return;
        }

        const delay = getReconnectDelay(reconnectAttemptRef.current);
        setConnectionState("reconnecting");
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror, handling reconnect logic there
      };
    }

    connect();

    return () => {
      closedManuallyRef.current = true;
      cleanup();
    };
  }, [resumeId, disabled, cleanup]);

  return { connectionState, close };
}
