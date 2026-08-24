"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { createResumeStatusSocket, type ResumeStatusSocketHandle } from "@/lib/realtime/socket";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "fallback" | "closed";

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
 * Transport mechanics — URL construction, keepalive pings, message decoding,
 * exponential-backoff reconnects, and the close-code 1000 policy — live in
 * the shared lib/realtime/socket.ts. This hook wraps them in a React state
 * machine: opens a WebSocket to /ws/resume-status, receives push
 * notifications from the ClickfolioStatusDO Durable Object, auto-reconnects,
 * and falls back to `connectionState: "fallback"` after
 * WS_MAX_RECONNECT_ATTEMPTS failures so callers can activate HTTP polling.
 */
export function useResumeWebSocket({
  resumeId,
  onStatusChange,
  disabled = false,
}: UseResumeWebSocketOptions): UseResumeWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("closed");

  const socketHandleRef = useRef<ResumeStatusSocketHandle | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const lastStatusRef = useRef<ResumeStatus | null>(null);

  // Keep callback ref up to date without re-triggering effect
  onStatusChangeRef.current = onStatusChange;

  const disconnect = useCallback(() => {
    socketHandleRef.current?.dispose();
    socketHandleRef.current = null;
  }, []);

  const close = useCallback(() => {
    disconnect();
    setConnectionState("closed");
  }, [disconnect]);

  useEffect(() => {
    if (!resumeId || disabled) {
      disconnect();
      setConnectionState("closed");
      return;
    }

    setConnectionState("connecting");

    socketHandleRef.current = createResumeStatusSocket(resumeId, {
      onOpen: () => setConnectionState("connected"),
      onMessage: (msg) => {
        if (msg.type !== "status") return;
        lastStatusRef.current = msg.status;
        onStatusChangeRef.current(msg.status, msg.error);
      },
      onClose: (event) => {
        // Server alarm closes with 1000 after 30s (see ClickfolioStatusDO.alarm).
        // Treat 1000 as terminal only when we already received a terminal status;
        // otherwise it would dead-lock the client if the broadcast was missed.
        if (event.code !== 1000) return false;
        const isTerminal =
          lastStatusRef.current === "completed" || lastStatusRef.current === "failed";
        if (!isTerminal) return false;
        setConnectionState("closed");
        return true;
      },
      onRetry: () => setConnectionState("reconnecting"),
      onFallback: () => setConnectionState("fallback"),
    });

    return () => {
      disconnect();
    };
  }, [resumeId, disabled, disconnect]);

  return { connectionState, close };
}
