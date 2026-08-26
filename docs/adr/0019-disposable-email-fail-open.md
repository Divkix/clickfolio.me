> **SUPERSEDED by Clerk production disposable-domain blocking** — Clerk's production
> instance now blocks disposable domains at signup, and the KV-backed
> `isDisposableEmail()` check (`lib/email/disposable-check.ts`) was removed along with
> the domain-sync cron. Kept for historical context.

# Disposable-email check is fail-open

Only an explicit `APIError` from the `databaseHooks.user.create.before` hook blocks signup. KV/network errors let signup through (availability over strictness); email verification is the safety net.
