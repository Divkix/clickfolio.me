# clickfolio.me

Turns a PDF resume into a hosted web portfolio at `/@handle`: upload a PDF, an AI parses it, you get a shareable link.

## Language

**Retry eligibility**:
Whether a failed resume may be manually re-queued for another parse attempt. Judged in one place (`lib/resume/lifecycle.ts:checkRetryEligibility` / `canRetryResume`) from the resume's status, retry count, total attempts, and last error type (the stored `QueueError` JSON shape is owned there; callers pass the raw row).
_Avoid_: can_retry, retryable, "can it be retried"

**Status view**:
The public presentation of a resume row — status, progress, error text, Retry eligibility — computed in one module from the stored row. The virtual `waiting_for_cache` timeout is normalized there, not at call sites.
_Avoid_: status mapping, presentation logic, "public status"

**Claim intake**:
Turning a validated temp upload key into a queued (or deduped) resume in one module: R2 move, per-user fileHash dedup (cache-hit → completed, in-flight → `waiting_for_cache`), enqueue with rollback to `pending_claim`. Takes a validated tempKey; cookie verification stays in the route.
_Avoid_: claim flow, claim handler

**Resume completion**:
Marking resumes completed with parsed content in one module: the complete txn + site-data upsert, the single name/role sync rule (role iff AI-provided, name iff missing), and the status notify. The cached-hit, fresh-parse, and waiting fan-out paths all call it.
_Avoid_: complete flow, finalize, publish step
