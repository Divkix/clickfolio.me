# pendingR2Deletions rows written before the delete batch; no user FK

Status: superseded by [0026](0026-cloudflare-workflows-parse-and-r2-deletion.md) — failed deletes go to `R2DeleteWorkflow`; the table is dropped (migration 0007).

In account deletion, failed R2 deletes are recorded in `pendingR2Deletions` BEFORE the DB delete batch, and the table intentionally has no FK to `user`. The user row is gone when the 2 AM cron retries the R2 delete, so recording the key durably first preserves GDPR cleanup.
