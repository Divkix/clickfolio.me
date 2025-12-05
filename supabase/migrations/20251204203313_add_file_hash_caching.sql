-- Add file_hash column for caching parsed resume content
-- When same file is uploaded again, skip Replicate and return cached result

ALTER TABLE public.resumes ADD COLUMN file_hash text;

-- Index for fast lookups on completed resumes with hash
-- Only index completed resumes with a hash (partial index for efficiency)
CREATE INDEX idx_resumes_file_hash_completed
  ON public.resumes(file_hash)
  WHERE status = 'completed' AND file_hash IS NOT NULL;

-- Index for processing status lookups (deduplication check)
-- Used when checking if another upload with same hash is already being processed
CREATE INDEX idx_resumes_file_hash_processing
  ON public.resumes(file_hash)
  WHERE status = 'processing' AND file_hash IS NOT NULL;

COMMENT ON COLUMN public.resumes.file_hash IS 'SHA-256 hash of uploaded PDF for deduplication caching';
