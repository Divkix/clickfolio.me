# unknown parse error is non-retryable

`classifyParseError()` treats `unknown` as permanent, not retryable. Only the four transient types (`db_connection_error`, `service_binding_timeout`, `r2_throttle`, `ai_provider_error`) retry. `ResumeParseWorkflow` rethrows every non-retryable `ParseError` as `NonRetryableError`, so an unrecognized error goes straight to `mark failed` instead of burning step retries on something we can't classify as transient. (Originally: `ack()` → DLQ under the Queue consumer; see [0026](0026-cloudflare-workflows-parse-and-r2-deletion.md).)
