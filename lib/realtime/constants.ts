export const WS_MAX_RECONNECT_ATTEMPTS = 3;
export const WS_PING_INTERVAL_MS = 30000;
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_CAP_MS = 10000;
export const POLL_INTERVAL_MS = 3000;

export function getReconnectDelay(attempt: number): number {
  return (
    Math.min(WS_RECONNECT_CAP_MS, WS_RECONNECT_BASE_MS * 2 ** (attempt - 1)) +
    Math.floor(Math.random() * 200)
  );
}
