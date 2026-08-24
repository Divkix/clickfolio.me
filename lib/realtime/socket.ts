/**
 * Shared WebSocket transport for resume status updates.
 *
 * Encapsulates the logic previously duplicated between
 * hooks/useResumeWebSocket.ts (React state machine) and
 * lib/utils/wait-for-completion.ts (promise wrapper): URL construction,
 * keepalive pings, message decoding, reconnect backoff, close-code 1000
 * policy, and the polling-fallback trigger. Consumers only supply handlers.
 */

import { z } from "zod";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import {
  getReconnectDelay,
  isValidResumeStatus,
  shouldRetry,
  WS_PING_INTERVAL_MS,
} from "@/lib/realtime/constants";

/** Build the /ws/resume-status WebSocket URL for a resume from current location. */
export function buildResumeStatusWsUrl(resumeId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/resume-status?resume_id=${resumeId}`;
}

/** Decoded /ws/resume-status frame: { type: "status", status, error? }. */
export interface ResumeStatusPayload {
  type: string;
  status: ResumeStatus;
  error?: string;
}

/**
 * Decode a raw WebSocket frame into a status payload.
 *
 * Returns null for non-string frames, "pong" keepalive replies, malformed
 * JSON, and payloads whose status fails the isValidResumeStatus gate.
 */
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
  /** Decoded status frame arrived (pings/pongs/malformed frames filtered out). */
  onMessage?: (message: ResumeStatusPayload) => void;
  /** Socket opened; keepalive pings are managed by the transport. */
  onOpen?: () => void;
  /**
   * Inspect an unexpected close before reconnect logic runs. Return true to
   * treat the close as terminal and stop the transport (used for close code
   * 1000 after a terminal status was observed); anything else falls through
   * to reconnect/backoff and eventually onFallback. Omit to always retry —
   * promise-style consumers must never suppress code 1000 because the DO
   * alarm closes with 1000 after 30s and the terminal broadcast may have
   * been missed.
   */
  onClose?: (event: CloseEvent) => boolean;
  /** A reconnect is being scheduled after `attempt` failed attempts. */
  onRetry?: (attempt: number) => void;
  /** Reconnect budget exhausted — activate HTTP polling now. Called once. */
  onFallback?: () => void;
}

export interface ResumeStatusSocketHandle {
  /**
   * Stop the transport: clear timers, detach handlers, close the socket.
   * `reason` becomes the WebSocket close reason (default "cleanup").
   */
  dispose: (reason?: string) => void;
}

/**
 * Open a resume-status WebSocket with keepalive pings (literal "ping" every
 * WS_PING_INTERVAL_MS while OPEN), automatic frame decoding, reconnects with
 * exponential backoff (shouldRetry/getReconnectDelay), and a single
 * onFallback notification when the reconnect budget is exhausted.
 */
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
      // Detach before closing so late close events cannot re-trigger handlers.
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
      // Keepalive: the DO alarm drops idle connections after 30s.
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

      // Consumer decides whether this close is terminal (e.g. code 1000
      // after a completed/failed status was observed). Otherwise reconnect
      // with backoff, then hand over to the consumer's polling fallback.
      if (handlers.onClose?.(event)) return;

      attempts++;
      if (!shouldRetry(attempts)) {
        handlers.onFallback?.();
        return;
      }
      handlers.onRetry?.(attempts);
      reconnectTimer = setTimeout(connect, getReconnectDelay(attempts));
    };

    socket.onerror = () => {
      // onclose always follows onerror; reconnect logic lives there.
    };
  }

  connect();

  return { dispose };
}
