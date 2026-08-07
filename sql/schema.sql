-- waflow Supabase schema. Run in the Supabase SQL editor.
-- Only needed when STORAGE=supabase (durable conversation state).
-- Completed leads go to YOUR CRM via a Bot.onLead handler, not here.

create table if not exists public.wa_conversations (
  "from"     text primary key,
  step       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- The service-role key bypasses RLS. Enable RLS so the anon key can't read it.
alter table public.wa_conversations enable row level security;
