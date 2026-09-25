# Retryable errors re-queue (never a false-negative failed)

Status: superseded by [0026](0026-cloudflare-workflows-parse-and-r2-deletion.md) — retries happen inside the workflow's parse step, so the row stays `processing` and no re-claim is needed.

On a RETRYABLE parse error the consumer writes `lastAttemptError` and sets status back to `queued`, so the redelivery can claim the row. Leaving it `processing` made the next delivery a no-op that the worker then acknowledged. `queued` is presented as in-progress, so the user still does not see a false-negative `failed` mid-retry. `failed` is written only on a non-retryable error, or by the DLQ consumer after retries are exhausted (Issues #83 / #91).
