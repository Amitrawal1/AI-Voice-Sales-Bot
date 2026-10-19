-- Run this once in the Supabase SQL editor.
create table if not exists calls (
  id             uuid primary key default gen_random_uuid(),
  vapi_call_id   text unique,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_sec   integer not null default 0,
  language       text not null default 'en',
  transcript     jsonb not null default '[]'::jsonb,  -- [{role: 'assistant'|'user', text, at}]
  recording_url  text,
  summary        text,
  requirements   jsonb not null default '[]'::jsonb,
  objections     jsonb not null default '[]'::jsonb,
  next_steps     jsonb not null default '[]'::jsonb,
  status         text check (status in (
                   'Converted', 'Interested', 'Follow-up Required',
                   'Not Interested', 'Demo Requested', 'No Response'
                 )),
  consent_given  boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists calls_started_at_idx on calls (started_at desc);

-- Only the server (service role key) touches this table.
alter table calls enable row level security;
