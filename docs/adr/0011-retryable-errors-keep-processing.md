# Retryable errors keep status processing (never a false-negative failed)

On a RETRYABLE parse error the consumer leaves the resume `processing` and records `lastAttemptError` only. `failed` is written only on a non-retryable error, or by the DLQ consumer after retries are exhausted. This avoids showing the user a false-negative failure mid-retry (Issues #83 / #91).
