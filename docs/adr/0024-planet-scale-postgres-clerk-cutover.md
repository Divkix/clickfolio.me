# PlanetScale Postgres via Hyperdrive + Clerk clean cutover

**Date:** 2026-08 • **Status:** Accepted

## Decision

The data and auth layers were cut over in one clean cutover with no compatibility
shims:

- **Database:** Cloudflare D1 (SQLite) → **PlanetScale Postgres**, reached from the
  Worker through the **Cloudflare Hyperdrive binding `HYPERDRIVE`**
  (`getDb(env.HYPERDRIVE)` in `lib/db/index.ts`, postgres-js driver,
  `drizzle-orm/postgres-js`). The canonical schema is `@/lib/db/schema`
  (`drizzle-orm/pg-core`); migrations live in `migrations_pg/` and run via
  drizzle-kit against `DATABASE_URL`.
- **Auth:** Better Auth → **Clerk**. The browser holds Clerk's `__session` JWT;
  the Worker verifies it against Clerk's JWKS with `verifyToken()` from
  `@clerk/backend` (`lib/auth/clerk.ts`) and maps it to the local row via
  `user.clerk_id`. Client UI is Clerk's prebuilt `<SignIn>/<SignUp>` (rendered in
  `components/auth/AuthDialog.tsx` under `ClerkProvider`). User lifecycle syncs
  through the Svix-verified webhook at `/api/webhooks/clerk`. The 53 migrated
  users keep their legacy ids as Clerk `externalId`; new users use their Clerk id
  as the Postgres PK.
- **Secrets/env:** `PENDING_UPLOAD_SECRET` replaces `BETTER_AUTH_SECRET` as the
  pending-upload HMAC key; `APP_URL` replaces `BETTER_AUTH_URL` as the app URL;
  Clerk keys are `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Why

D1's single-writer SQLite model and Better Auth's session-table machinery were the
two biggest constraints on the product roadmap: no real transactions across
statements (`db.batch()` was all-or-nothing but not interactive), text-encoded
timestamps, and auth code that had to live inside the Worker. PlanetScale Postgres
gives real transactions (`db.transaction`), native `jsonb`/`timestamptz`/
`boolean` types, and connection pooling at the edge via Hyperdrive; Clerk moves
session storage, OAuth (Google), email verification, and password flows out of the
app entirely.

## Consequences

- **Single DB accessor.** `getDb(env.HYPERDRIVE)` is the only entry point
  (Map-cached per connection string per isolate). The D1 session variants and the
  read-your-own-writes bookmark cookie are **deleted** — Postgres via Hyperdrive
  is strongly consistent on the primary, so every read sees prior writes.
- **Transactions replace `db.batch()`.** Multi-statement atomicity is
  `db.transaction(async (tx) => ...)`; postgres-js reports affected rows via
  `.count`/`.returning()`.
- **Native types.** Timestamps are `timestamptz` with `mode:"string"` (ISO strings
  at the app layer, as before); JSON columns are `jsonb` parsed/serialized by
  Drizzle (callers must NOT hand-roll `JSON.parse`/`stringify`); booleans are real
  booleans. Unique-violation races surface as SQLSTATE `23505` /
  `duplicate key value` → mapped to HTTP 409.
- **Fewer tables.** `session`, `account`, and `verification` are gone
  (`migrations_pg/0001_drop_better_auth_tables.sql`); 7 app tables remain.
  App-owned user data (handle, privacy, referral, admin flags) stays in Postgres;
  referral-count triggers were ported to PL/pgSQL
  (`migrations_pg/0002_referral_count_triggers.sql`).
- **Identity mapping.** Clerk id ↔ local row is 1:1 via UNIQUE
  `user.clerk_id`; the webhook resolves an incoming identity by `clerk_id`
  first, then by Clerk `externalId` (= pre-migration `user.id`), never by email.
- **Account deletion** calls Clerk's Backend API `deleteUser` FIRST (a surviving
  identity would re-authenticate into a dead end), then deletes the local row
  (CASCADE); the `user.deleted` webhook is the safety net.
- **Operational:** the remote D1 database is kept dormant as a cold backup (no
  binding, no code path); `DATABASE_URL` (direct PlanetScale URL) is required by
  drizzle-kit locally but never used by the deployed Worker.
