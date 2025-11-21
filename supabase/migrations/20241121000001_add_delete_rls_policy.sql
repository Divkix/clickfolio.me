-- Add missing DELETE policy for resumes table
-- Users should be able to delete their own resumes

create policy "Users can delete own resumes"
  on resumes for delete
  using (auth.uid() = user_id);
