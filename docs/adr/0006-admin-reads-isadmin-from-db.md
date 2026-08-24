# Admin re-reads isAdmin from the database on every request

`requireAdminAuth()` / `requireAdminAuthForApi()` (`lib/auth/admin.ts`) call `getServerSession()` then re-query the user row via `getDb(env.HYPERDRIVE)` (PlanetScale Postgres; originally `getDb(env.CLICKFOLIO_DB)` on D1) and check the real `isAdmin` boolean — never trusting session/JWT claims (including Clerk JWT claims). This makes revoking admin immediate.
