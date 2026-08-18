/**
 * Server-side auth email throttle — prevents auth-email abuse amplification.
 *
 * Context: a 24,446-bill incident was not caused by auth resend, but hardening
 * is load-bearing. Without a server throttle, a bot spamming
 * `/api/auth/send-verification-email` or `/api/auth/request-password-reset`
 * could amplify sends. Client-side `useResendCooldown` is trivially bypassed.
 *
 * Design: per-isolate in-memory Map with 60s TTL per (type, email) key.
 * - Fail-open: any exception returns "not throttled" so legitimate users are
 *   never blocked by infra errors.
 * - Pretend-sent: callers return `{success:true}` when throttled to avoid
 *   timing/oracle leaks about whether the address was rate-limited.
 * - Per-isolate only: durable cross-isolate limiting would require a new
 *   binding (Workers Rate Limiting API or a dedicated KV namespace). The
 *   existing KV `CLICKFOLIO_DISPOSABLE_DOMAINS` is not suitable. This Map is
 *   still effective per isolate and as defense-in-depth alongside Better Auth's
 *   own verification-token reuse.
 *
 * TODO: If abuse persists across isolates, migrate to Cloudflare Workers Rate
 * Limiting API or a dedicated KV namespace with 60s TTL — see ADR.
 */

export const EMAIL_THROTTLE_COOLDOWN_MS = 60_000;

const lastSentByKey = new Map<string, number>();

export function getEmailThrottleKey(email: string, type: "verification" | "reset"): string {
  return `${type}:${email.trim().toLowerCase()}`;
}

export function isThrottled(key: string): boolean {
  try {
    const normalized = key.trim().toLowerCase();
    const last = lastSentByKey.get(normalized);
    if (last === undefined) return false;
    const elapsed = Date.now() - last;
    if (elapsed >= EMAIL_THROTTLE_COOLDOWN_MS) {
      // Expired — prune lazily
      lastSentByKey.delete(normalized);
      return false;
    }
    return true;
  } catch {
    // Fail open
    return false;
  }
}

export function recordThrottle(key: string): void {
  try {
    lastSentByKey.set(key.trim().toLowerCase(), Date.now());
  } catch {
    // Fail open — ignore
  }
}

/**
 * Check if `key` is throttled. If not, record the current timestamp and
 * return false (not throttled). If throttled, return true without updating
 * the timestamp — the original window stays authoritative.
 *
 * Fail-open: any exception returns false.
 */
export function checkEmailThrottle(key: string): boolean {
  try {
    if (isThrottled(key)) return true;
    recordThrottle(key);
    return false;
  } catch {
    return false;
  }
}

/** Test-only: clear all throttle state. */
export function clearEmailThrottleForTesting(): void {
  lastSentByKey.clear();
}
