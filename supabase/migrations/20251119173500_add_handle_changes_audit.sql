-- Create audit table for handle changes to enable precise rate limiting
-- This replaces the imprecise approach of counting all profile updates

CREATE TABLE public.handle_changes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  old_handle text,
  new_handle text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX handle_changes_user_id_idx ON public.handle_changes(user_id);
CREATE INDEX handle_changes_created_at_idx ON public.handle_changes(created_at);

-- RLS Policies
ALTER TABLE public.handle_changes ENABLE ROW LEVEL SECURITY;

-- Users can view their own handle change history
CREATE POLICY "Users can view own handle changes"
  ON public.handle_changes FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert handle changes (enforced via API)
-- No user-facing INSERT policy - only server-side operations
