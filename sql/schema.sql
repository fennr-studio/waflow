-- waflow Supabase schema. Run in the Supabase SQL editor.
-- Used only when STORAGE=supabase.

create table if not exists public.wa_conversations (
  "from"     text primary key,
  step       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_leads (
  id           uuid primary key default gen_random_uuid(),
  "from"       text not null,
  name         text,
  data         jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create index if not exists wa_leads_from_idx on public.wa_leads ("from");
create index if not exists wa_leads_completed_at_idx on public.wa_leads (completed_at desc);

-- The service-role key bypasses RLS. Enable RLS so the anon key can't read
-- these tables; the server uses the service-role key.
alter table public.wa_conversations enable row level security;
alter table public.wa_leads enable row level security;
