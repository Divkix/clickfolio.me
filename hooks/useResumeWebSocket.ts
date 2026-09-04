"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { createResumeStatusSocket, type ResumeStatusSocketHandle } from "@/lib/realtime/socket";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "fallback" | "closed";

interface UseResumeWebSocketOptions {
  resumeId: string | null;
  onStatusChange: (status: ResumeStatus, error?: string) => void;
  disabled?: boolean;
}

interface UseResumeWebSocketReturn {
  connectionState: ConnectionState;
  close: () => void;
}

export function useResumeWebSocket({
  resumeId,
  onStatusChange,
  disabled = false,
}: UseResumeWebSocketOptions): UseResumeWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("closed");

  const socketHandleRef = useRef<ResumeStatusSocketHandle | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const lastStatusRef = useRef<ResumeStatus | null>(null);

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
