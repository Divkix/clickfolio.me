-- Add parsed_content column for caching (stores normalized AI output)
-- This allows the file hash cache to work independently of site_data
-- which gets overwritten on each new upload (onConflict: "user_id")

ALTER TABLE public.resumes ADD COLUMN parsed_content jsonb;

COMMENT ON COLUMN public.resumes.parsed_content IS
  'Normalized AI-parsed content for caching. Used to skip Replicate on duplicate uploads.';
