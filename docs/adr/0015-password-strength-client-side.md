> **SUPERSEDED by [0024](0024-planet-scale-postgres-clerk-cutover.md)** — the sign-up form
> (and password policy) is now owned by Clerk's prebuilt UI; `lib/password/` is unused legacy.

# Server password validation is length-only; strength is client-side

Server-side `passwordSchema` checks length 8–128 only. HIBP breach and zxcvbn strength checks (`lib/password/`) run CLIENT-SIDE ONLY. Bundling ~1.73 MB of zxcvbn dictionaries into the Worker is unacceptable, so `@zxcvbn-ts/*` is SSR-stubbed (the stub `.check()` always returns score 0).
