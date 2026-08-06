# clickfolio.me

Turns a PDF resume into a hosted web portfolio at `/@handle`: upload a PDF, an AI parses it, you get a shareable link.

## Language

**Retry eligibility**:
Whether a failed resume may be manually re-queued for another parse attempt. Judged in one place (`lib/resume/lifecycle.ts:checkRetryEligibility` / `canRetryResume`) from the resume's status, retry count, total attempts, and last error type (the stored `QueueError` JSON shape is owned there; callers pass the raw row).
_Avoid_: can_retry, retryable, "can it be retried"
