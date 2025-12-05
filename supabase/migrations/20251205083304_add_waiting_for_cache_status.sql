-- Add 'waiting_for_cache' status for resumes waiting on another upload's parsing result
-- This status is used when a file with the same hash is already being processed,
-- allowing the webhook to fan out results to all waiting resumes.

-- Drop the existing inline check constraint (auto-named by PostgreSQL)
-- PostgreSQL names inline constraints as: {table}_{column}_check
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_status_check;

-- Add new check constraint including 'waiting_for_cache' status
ALTER TABLE public.resumes
  ADD CONSTRAINT resumes_status_check
  CHECK (status IN ('pending_claim', 'processing', 'completed', 'failed', 'waiting_for_cache'));

-- Create partial index for efficient lookup of resumes waiting for cache results
-- Used by webhook fan-out to find all resumes waiting on a specific file hash
CREATE INDEX idx_resumes_waiting_for_cache
  ON public.resumes(file_hash)
  WHERE status = 'waiting_for_cache' AND file_hash IS NOT NULL;

COMMENT ON INDEX idx_resumes_waiting_for_cache IS 'Partial index for webhook fan-out to find resumes waiting on cached parsing results';
