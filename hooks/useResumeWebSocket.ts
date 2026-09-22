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
  // The socket subsystem is either off (no id or disabled) or starting up for
  // this key; "closed" while off is derived, never stored.
  const activeKey = resumeId !== null && !disabled ? resumeId : null;
  const [socketState, setSocketState] = useState<ConnectionState>("connecting");
  const [prevActiveKey, setPrevActiveKey] = useState(activeKey);

  if (activeKey !== prevActiveKey) {
    setPrevActiveKey(activeKey);
    setSocketState("connecting");
  }

  const connectionState: ConnectionState = activeKey === null ? "closed" : socketState;

  const socketHandleRef = useRef<ResumeStatusSocketHandle | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const lastStatusRef = useRef<ResumeStatus | null>(null);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const disconnect = useCallback(() => {
    socketHandleRef.current?.dispose();
    socketHandleRef.current = null;
  }, []);

  const close = useCallback(() => {
    disconnect();
    setSocketState("closed");
  }, [disconnect]);

  useEffect(() => {
    if (activeKey === null) {
      disconnect();

      return;
    }

    socketHandleRef.current = createResumeStatusSocket(activeKey, {
      onOpen: () => setSocketState("connected"),
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
        setSocketState("closed");

        return true;
      },
      onRetry: () => setSocketState("reconnecting"),
      onFallback: () => setSocketState("fallback"),
    });

    return () => {
      disconnect();
    };
  }, [activeKey, disconnect]);

  return { connectionState, close };
}
