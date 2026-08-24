> **SUPERSEDED by [0024](0024-planet-scale-postgres-clerk-cutover.md)** — Better Auth
> (and `getAuth()`) was removed in the Clerk cutover. Kept for historical context.

# getAuth() is built once per isolate, WeakMap-cached by D1 binding

`getAuth()` (`lib/auth/index.ts`) builds `betterAuth()` lazily on first call and caches the instance in a module-level `WeakMap` (`authInstanceCache`) keyed by `env.CLICKFOLIO_DB` (stable within an isolate). Subsequent calls reuse it; only headers/cookies pass per call. This avoids re-running schema parsing, plugin init, and route generation on every request — the instance is stateless.
