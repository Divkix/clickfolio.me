import { z } from "zod";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import {
  getReconnectDelay,
  isValidResumeStatus,
  shouldRetry,
  WS_MAX_MISSED_PINGS,
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

    let lastActivityAt = Date.now();
    socket = new WebSocket(buildResumeStatusWsUrl(resumeId));

    socket.onopen = () => {
      attempts = 0;
      lastActivityAt = Date.now();
      pingTimer = setInterval(() => {
        if (socket?.readyState !== WebSocket.OPEN) return;

        // A half-open socket never fires onclose, so liveness is judged by
        // traffic: no message (pong or status) for WS_MAX_MISSED_PINGS pings
        // means the connection is dead and polling takes over.
        if (Date.now() - lastActivityAt >= WS_PING_INTERVAL_MS * WS_MAX_MISSED_PINGS) {
          dispose("unresponsive connection");
          handlers.onFallback?.();
          return;
        }

        socket.send("ping");
      }, WS_PING_INTERVAL_MS);
      handlers.onOpen?.();
    };

    socket.onmessage = (event) => {
      lastActivityAt = Date.now();
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
