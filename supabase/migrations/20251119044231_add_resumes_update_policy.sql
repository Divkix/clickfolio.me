-- Add missing UPDATE policy for resumes table
-- This allows users to update their own resumes (status, replicate_job_id, etc.)
create policy "Users can update own resumes"
  on resumes for update
  using (auth.uid() = user_id);
