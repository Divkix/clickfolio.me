-- Drop the old index if it exists
DROP INDEX IF EXISTS idx_resumes_user_filename_active;

-- Fix idempotency index to:
-- 1. Extract full filename properly (not using split_part which fails on slashes)
-- 2. Only prevent duplicates for active uploads (not all non-failed)

CREATE UNIQUE INDEX idx_resumes_user_filename_active
ON resumes (user_id, (regexp_replace(r2_key, '^users/[^/]+/[^/]+/', '')))
WHERE status IN ('pending_claim', 'processing');

COMMENT ON INDEX idx_resumes_user_filename_active IS
'Prevents duplicate claims during upload race conditions. Uses regex to extract full filename.
Only blocks active uploads - allows re-upload of same filename after completion.';
