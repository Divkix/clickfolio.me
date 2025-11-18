-- Enable UUID extension (pgcrypto provides gen_random_uuid)
create extension if not exists "pgcrypto";

-- Profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  handle text unique not null check (char_length(handle) >= 3),
  email text not null,
  avatar_url text,
  headline text,
  privacy_settings jsonb default '{"show_phone": false, "show_address": false}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Indexes
create index profiles_handle_idx on profiles(handle);
create index profiles_email_idx on profiles(email);
