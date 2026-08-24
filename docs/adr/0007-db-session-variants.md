> **SUPERSEDED by [0024](0024-planet-scale-postgres-clerk-cutover.md)** — `lib/db/session.ts`
> and the bookmark/session-variant machinery were deleted in the PlanetScale Postgres
> cutover; `getDb(env.HYPERDRIVE)` is the single accessor. Kept for historical context.

# Four DB session variants; only getDb() is cached

`lib/db/session.ts` exposes `getDb()` (WeakMap-cached per binding), `getSessionDbWithPrimaryFirst()`, and `getSessionDbForWebhook()`. Read-your-own-writes needs the `d1-session-bookmark` cookie; post-signup needs `"first-primary"` to avoid FK errors before D1 replication; webhook/cron/WebSocket paths have no cookies. The two session variants wrap a per-request `d1.withSession()`, so they can't be isolate-cached — only `getDb()` gets the once-per-isolate cache.
