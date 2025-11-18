create table resumes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  r2_key text not null,
  status text not null default 'pending_claim' check (status in ('pending_claim', 'processing', 'completed', 'failed')),
  prediction_id text,
  error_message text,
  created_at timestamptz default now()
);

alter table resumes enable row level security;

create index resumes_user_id_idx on resumes(user_id);
create index resumes_status_idx on resumes(status);
