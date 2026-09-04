import { z } from "zod";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import {
  getReconnectDelay,
  isValidResumeStatus,
  shouldRetry,
  WS_PING_INTERVAL_MS,
} from "@/lib/realtime/constants";

export function buildResumeStatusWsUrl(resumeId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/resume-status?resume_id=${resumeId}`;
}

export interface ResumeStatusPayload {
  type: string;
  status: ResumeStatus;
  error?: string;
}

// eslint-disable-next-line anti-slop/no-unknown-parameters -- WebSocket event.data is untyped at I/O boundary; decoded via z.string().safeParse + isValidResumeStatus inside
export function decodeResumeStatusMessage(data: unknown): ResumeStatusPayload | null {
  const parsed = z.string().safeParse(data);
  if (!parsed.success || parsed.data === "pong") return null;
  try {
    // SAFETY: status validated immediately below via isValidResumeStatus; cast narrows the parsed shape with early return on invalid status
    const msg = JSON.parse(parsed.data) as ResumeStatusPayload;
    if (!isValidResumeStatus(msg.status)) return null;
    return msg;
  } catch {
    return null;
  }
}

export interface ResumeStatusSocketHandlers {
  onMessage?: (message: ResumeStatusPayload) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => boolean;
  onRetry?: (attempt: number) => void;
  onFallback?: () => void;
}

export interface ResumeStatusSocketHandle {
  dispose: (reason?: string) => void;
}

export function createResumeStatusSocket(
  resumeId: string,
  handlers: ResumeStatusSocketHandlers = {},
): ResumeStatusSocketHandle {
  let socket: WebSocket | null = null;
  let disposed = false;
  let attempts = 0;
  let pingTimer: NodeJS.Timeout | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;

  function dispose(reason = "cleanup") {
    if (disposed) return;
    disposed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close(1000, reason);
      socket = null;
    }
  }

  function connect() {
    if (disposed) return;

    socket = new WebSocket(buildResumeStatusWsUrl(resumeId));

    socket.onopen = () => {
      attempts = 0;
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send("ping");
        }
      }, WS_PING_INTERVAL_MS);
      handlers.onOpen?.();
    };

    socket.onmessage = (event) => {
      const msg = decodeResumeStatusMessage(event.data);
      if (msg) handlers.onMessage?.(msg);
    };

    socket.onclose = (event) => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      socket = null;
      if (disposed) return;

      if (handlers.onClose?.(event)) return;

      attempts++;
      if (!shouldRetry(attempts)) {
        handlers.onFallback?.();
        return;
      }
      handlers.onRetry?.(attempts);
      reconnectTimer = setTimeout(connect, getReconnectDelay(attempts));
    };

    socket.onerror = () => {};
  }

  connect();

  return { dispose };
}
