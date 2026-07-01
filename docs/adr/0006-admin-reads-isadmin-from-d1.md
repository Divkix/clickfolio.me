# Admin re-reads isAdmin from D1 on every request

`requireAdminAuth()` / `requireAdminAuthForApi()` (`lib/auth/admin.ts`) call `getServerSession()` then re-query the user row via `getDb(env.CLICKFOLIO_DB)` and check the real D1 `isAdmin` boolean — never trusting session/JWT claims. This makes revoking admin immediate and prevents a stale `cookieCache` from granting admin.
