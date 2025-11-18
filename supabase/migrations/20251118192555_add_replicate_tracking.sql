-- Add replicate job tracking columns to resumes table
ALTER TABLE public.resumes
ADD COLUMN replicate_job_id text,
ADD COLUMN parsed_at timestamp with time zone,
ADD COLUMN retry_count integer DEFAULT 0 NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.resumes.replicate_job_id IS 'Replicate prediction ID for tracking AI parsing job status';
COMMENT ON COLUMN public.resumes.parsed_at IS 'Timestamp when AI parsing completed successfully';
COMMENT ON COLUMN public.resumes.retry_count IS 'Number of times parsing has been retried (max 2)';
