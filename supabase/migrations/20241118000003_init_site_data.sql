create table site_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  resume_id uuid references resumes(id) on delete cascade,
  content jsonb not null,
  theme_id text default 'minimalist_creme',
  last_published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table site_data enable row level security;

create index site_data_user_id_idx on site_data(user_id);
