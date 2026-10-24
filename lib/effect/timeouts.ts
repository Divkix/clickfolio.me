/**
 * Time limits for every external call, in milliseconds. A timeout only stops waiting:
 * `pg` and Cloudflare bindings ignore the abort signal, so the operation can still finish.
 * Never retry a timed-out non-idempotent write (email, queue send, DO notify, R2 put/delete).
 * Keep these below the enclosing Workflow step timeout so the typed error surfaces first.
 */
export const TIMEOUT_MS = {
  db: 10_000,
  dbTransaction: 20_000,
  r2: 10_000,
  email: 10_000,
  queue: 5_000,
  durableObject: 5_000,
  clerk: 8_000,
  upstream: 5_000,
  /** A whole Umami call: a cold login plus the GET, one hop of up to 5s each. */
  umami: 10_000,
  workflow: 8_000,
} as const;
