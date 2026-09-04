-- Creative engine: async generation jobs, usage ledger, creative memory

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_input_id uuid not null references public.campaigns_input(id) on delete cascade,
  product_id uuid,
  creative_concept_id text,
  provider text,
  model text,
  asset_type text not null check (asset_type in ('image', 'video', 'pack')),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled', 'rejected')
  ),
  prompt text,
  negative_prompt text,
  source_assets jsonb not null default '{}'::jsonb,
  result_assets jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_cost numeric(12, 4) default 0,
  actual_cost numeric(12, 4) default 0,
  quota_used integer default 0,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists generation_jobs_user_id_idx on public.generation_jobs(user_id);
create index if not exists generation_jobs_campaign_input_id_idx on public.generation_jobs(campaign_input_id);
create index if not exists generation_jobs_status_idx on public.generation_jobs(status);

create table if not exists public.creative_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  provider text not null,
  model text,
  asset_type text not null check (asset_type in ('image', 'video', 'pack')),
  requests integer not null default 1,
  images_generated integer not null default 0,
  video_seconds integer not null default 0,
  estimated_cost numeric(12, 4) default 0,
  actual_cost numeric(12, 4) default 0,
  free_quota_consumed integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists creative_usage_user_id_idx on public.creative_usage(user_id);
create index if not exists creative_usage_created_at_idx on public.creative_usage(created_at desc);

create table if not exists public.creative_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creative_id uuid,
  campaign_id uuid,
  concept_id text,
  ad_format text,
  impressions bigint default 0,
  reach bigint default 0,
  ctr numeric(8, 4) default 0,
  cpc numeric(12, 4) default 0,
  conversions bigint default 0,
  cpa numeric(12, 4) default 0,
  roas numeric(12, 4) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_memory_user_id_idx on public.creative_memory(user_id);
create index if not exists creative_memory_concept_id_idx on public.creative_memory(concept_id);

alter table public.generation_jobs enable row level security;
alter table public.creative_usage enable row level security;
alter table public.creative_memory enable row level security;

create policy "Users manage own generation jobs"
  on public.generation_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users read own creative usage"
  on public.creative_usage
  for select
  using (auth.uid() = user_id);

create policy "Users manage own creative memory"
  on public.creative_memory
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
