-- Phase 5: persist every generated customs classification per user.

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 500),
  country text not null check (country ~ '^[A-Z]{2}$'),
  hs_code text not null check (hs_code ~ '^[0-9]{4}\.[0-9]{2}$'),
  hs_description text not null,
  estimated_duty text not null,
  documents text[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.shipments is 'AI-generated customs classifications, one row per generated shipment.';

-- Serves the dashboard query: one user's rows, newest first.
create index shipments_user_id_created_at_idx
  on public.shipments (user_id, created_at desc);

-- Row Level Security: signed-in users may read and create only their own rows.
-- No update or delete policies, so history is append-only from the client.
alter table public.shipments enable row level security;

create policy "Users can view their own shipments"
  on public.shipments for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own shipments"
  on public.shipments for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Explicit Data API privileges, so access doesn't depend on project defaults.
revoke all on public.shipments from anon;
grant select, insert on public.shipments to authenticated;
