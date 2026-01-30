"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "fallback" | "closed";

interface StatusMessage {
  type: "status";
  status: string;
  error?: string;
  timestamp: string;
}

interface UseResumeWebSocketOptions {
  /** Resume ID to subscribe to. null disables the connection. */
  resumeId: string | null;
  /** Called when a status update arrives via WebSocket. */
  onStatusChange: (status: string, error?: string) => void;
  /** Disable WebSocket and force polling fallback (e.g., for testing). */
  disabled?: boolean;
}

interface UseResumeWebSocketReturn {
  /** Current WebSocket connection state. */
  connectionState: ConnectionState;
  /** Manually close the WebSocket connection. */
  close: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 10000;
const PING_INTERVAL_MS = 30000;

/**
 * WebSocket hook for real-time resume status updates.
 *
 * Opens a WebSocket to /ws/resume-status, receives push notifications
 * from the ResumeStatusDO Durable Object, and auto-reconnects with
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
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        if (event.data === "pong") return;

        try {
          const msg = JSON.parse(event.data) as StatusMessage;
          if (msg.type === "status") {
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

        // Don't reconnect if manually closed or normal closure from server
        if (closedManuallyRef.current || event.code === 1000) {
          setConnectionState("closed");
          return;
        }

        // Attempt reconnect with exponential backoff
        reconnectAttemptRef.current++;
        if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
          setConnectionState("fallback");
          return;
        }

        const delay = Math.min(
          INITIAL_RECONNECT_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1),
          MAX_RECONNECT_DELAY_MS,
        );
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
