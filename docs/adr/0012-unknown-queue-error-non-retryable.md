# unknown queue error is non-retryable

`classifyQueueError()` treats `unknown` as permanent (→ `ack()` → DLQ), not retryable — only the four transient types (`db_connection_error`, `service_binding_timeout`, `r2_throttle`, `ai_provider_error`) retry. An unrecognized error goes straight to the DLQ rather than burning retries on something we can't classify as transient.
