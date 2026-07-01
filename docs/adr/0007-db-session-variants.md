# Four DB session variants; only getDb() is cached

`lib/db/session.ts` exposes `getDb()` (WeakMap-cached per binding), `getSessionDbWithPrimaryFirst()`, and `getSessionDbForWebhook()`. Read-your-own-writes needs the `d1-session-bookmark` cookie; post-signup needs `"first-primary"` to avoid FK errors before D1 replication; webhook/cron/WebSocket paths have no cookies. The two session variants wrap a per-request `d1.withSession()`, so they can't be isolate-cached — only `getDb()` gets the once-per-isolate cache.
