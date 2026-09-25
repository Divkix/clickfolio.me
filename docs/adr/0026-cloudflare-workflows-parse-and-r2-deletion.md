# Cloudflare Workflows for resume parsing and R2 deletion; R2 lifecycle for temp uploads

Status: accepted. Supersedes [0009](0009-pending-r2-deletions-before-batch.md) and [0011](0011-retryable-errors-keep-processing.md).

## Context

The parse pipeline was a Queue consumer plus a DLQ plus a `*/15` orphan-recovery cron. Between them they hand-rolled retry state (`retryCount` flips, `queued`↔`processing` re-claims, DLQ alerting). R2 deletion retries were a `pending_r2_deletions` table swept by a 2 AM cron, which also deleted `temp/` uploads older than 24h.

## Decision

- **`ResumeParseWorkflow`** (`lib/workflows/resume-parse-workflow.ts`) runs `claim → parse → complete` as durable steps. The step bodies live in `lib/parse/pipeline.ts`.
  - The parse step retries transient `ParseError`s: 3 retries, 30s exponential backoff, 10-minute timeout.
  - Permanent errors, including `unknown` (ADR-0012), are rethrown as `NonRetryableError`.
  - Any terminal error runs a `mark failed` step (failed status, DO notify, alert), then rethrows.
- **Instance id = resume id** (`parseInstanceId`). A manual retry uses `{id}-retry-{n}`. `startResumeParse` treats "already exists" as success, so a repeated start never forks a second parse.
- **Claim fails fast.** If the workflow cannot start, the row is marked `failed` (retryable from the UI) instead of being left in `pending_claim` for a cron.
- **`waiting_for_cache`** starts an `await-cache` instance. It sleeps `WAITING_FOR_CACHE_TIMEOUT_MS`, then persists the timeout if the row is still waiting. This replaces the cron half that made the virtual timeout durable.
- **`R2DeleteWorkflow`** (`lib/workflows/r2-delete-workflow.ts`) takes `{keys, prefix?}`. It lists the prefix and deletes in batches of 1000, with 8 retries per step.
  - Account deletion, the Clerk `user.deleted` webhook and admin dismiss try inline first (`deleteR2Objects`) and hand only the failed keys to it.
  - The webhook starts it _before_ the cascade, so a failed start fails the webhook and Svix redelivers.
- **`temp/` expiry** is an R2 lifecycle rule (`r2-lifecycle.json`, 1 day). `scripts/deploy.ts` applies it. `lifecycle set` replaces every rule on the bucket, so the file also keeps the default multipart-abort rule.

## Consequences

- Removed: the parse queue and DLQ bindings, `lib/queue/`, `lib/cron/cleanup-r2.ts`, `lib/cron/recover-orphaned.ts`, their `/api/cron/*` routes, the `0 2` and `*/15` crons, and the `pending_r2_deletions` table (migration `0007`).
- Retry and backoff state lives in the Workflows runtime, not in DB columns. `retryCount` now counts manual retries only; `totalAttempts` still counts parse attempts in SQL.
- Step bodies must be idempotent, because a step can replay. They guard with status-conditioned `UPDATE … RETURNING` and SQL-side increments.
- Instance history and step errors are visible in the Workflows dashboard. There is no DLQ to drain.
