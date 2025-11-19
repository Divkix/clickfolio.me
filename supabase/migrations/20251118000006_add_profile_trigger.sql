-- Add trigger to auto-create profile when user signs up via OAuth
-- This ensures the profiles table always has an entry for authenticated users

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, avatar_url, handle)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    substring(md5(new.email) from 1 for 12) -- temp handle from email hash
  );
  return new;
end;
$$;

-- Trigger that fires after user is created in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
