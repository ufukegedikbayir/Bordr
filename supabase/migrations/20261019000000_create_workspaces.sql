-- Phase 6: multi-tenant workspaces. Shipments belong to a workspace, and users
-- reach data only through workspace membership.

-- Helpers live in a schema the Data API does not expose, so they can't be
-- called over REST. Signed-in users still need usage to evaluate policies.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

comment on table public.workspaces is 'Tenants (companies). All business data is owned by a workspace.';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

comment on table public.workspace_members is 'Which users belong to which workspace, and with what role.';

-- The primary key serves lookups by workspace; this serves "my workspaces",
-- which every RLS check below runs.
create index workspace_members_user_id_idx
  on public.workspace_members (user_id, workspace_id);

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------
-- Security definer so policies on workspace_members can consult
-- workspace_members without recursing into their own RLS. Policies call them
-- as `x in (select ...)` so Postgres evaluates them once per statement.

create function private.user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = (select auth.uid());
$$;

create function private.owned_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = (select auth.uid())
    and m.role = 'owner';
$$;

-- Column default for shipments.workspace_id: the caller's oldest workspace.
-- Lets inserts that don't name a workspace yet keep working.
create function private.default_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = (select auth.uid())
  order by m.created_at, m.workspace_id
  limit 1;
$$;

create function private.personal_workspace_name(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(left(btrim(split_part(email, '@', 1)), 80), '') || '''s Workspace',
    'My Workspace'
  );
$$;

revoke all on function
  private.user_workspace_ids(),
  private.owned_workspace_ids(),
  private.default_workspace_id(),
  private.personal_workspace_name(text)
from public;

grant execute on function
  private.user_workspace_ids(),
  private.owned_workspace_ids(),
  private.default_workspace_id()
to authenticated;

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- Every workspace keeps at least one owner. Removals that come from deleting
-- the workspace itself or the user's auth account are let through.
create function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  losing_owner boolean;
begin
  -- NEW is null on DELETE, so don't read it in the same expression.
  if tg_op = 'DELETE' then
    losing_owner := old.role = 'owner';
  else
    losing_owner := old.role = 'owner' and new.role <> 'owner';
  end if;

  if losing_owner then
    -- Lock the workspace row so two owners demoting each other at once
    -- can't both pass the check.
    perform 1 from public.workspaces w where w.id = old.workspace_id for update;

    if found
      and exists (select 1 from auth.users u where u.id = old.user_id)
      and not exists (
        select 1
        from public.workspace_members m
        where m.workspace_id = old.workspace_id
          and m.role = 'owner'
          and m.user_id <> old.user_id
      )
    then
      raise exception 'A workspace must keep at least one owner'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger workspace_members_protect_last_owner
  before update or delete on public.workspace_members
  for each row execute function private.protect_last_owner();

-- Every new user starts with a personal workspace they own.
create function private.create_personal_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (name)
  values (private.personal_workspace_name(new.email))
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created_create_workspace
  after insert on auth.users
  for each row execute function private.create_personal_workspace();

revoke all on function private.protect_last_owner(), private.create_personal_workspace() from public;

-- ---------------------------------------------------------------------------
-- Backfill: existing users get the personal workspace new users get.
-- ---------------------------------------------------------------------------

do $$
declare
  existing_user record;
  new_workspace_id uuid;
begin
  for existing_user in select id, email from auth.users loop
    insert into public.workspaces (name)
    values (private.personal_workspace_name(existing_user.email))
    returning id into new_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, existing_user.id, 'owner');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shipments move from per-user to per-workspace ownership
-- ---------------------------------------------------------------------------

-- Restrict, not cascade: deleting a company must not silently erase its
-- customs records.
alter table public.shipments
  add column workspace_id uuid references public.workspaces (id) on delete restrict;

-- Each existing user has exactly one membership at this point.
update public.shipments s
set workspace_id = m.workspace_id
from public.workspace_members m
where m.user_id = s.user_id;

alter table public.shipments
  alter column workspace_id set not null,
  alter column workspace_id set default private.default_workspace_id();

-- Serves the workspace history query: one workspace's rows, newest first.
create index shipments_workspace_id_created_at_idx
  on public.shipments (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- workspaces: members read; owners rename. Creation goes through
-- create_workspace() so the creator becomes owner atomically. No deletes yet.
alter table public.workspaces enable row level security;

create policy "Members can view their workspaces"
  on public.workspaces for select
  to authenticated
  using (id in (select private.user_workspace_ids()));

create policy "Owners can rename their workspaces"
  on public.workspaces for update
  to authenticated
  using (id in (select private.owned_workspace_ids()))
  with check (id in (select private.owned_workspace_ids()));

-- workspace_members: members see who else is in their workspaces; owners
-- manage membership; anyone may leave (the last owner can't, see trigger).
alter table public.workspace_members enable row level security;

create policy "Members can view members of their workspaces"
  on public.workspace_members for select
  to authenticated
  using (workspace_id in (select private.user_workspace_ids()));

create policy "Owners can add members"
  on public.workspace_members for insert
  to authenticated
  with check (workspace_id in (select private.owned_workspace_ids()));

create policy "Owners can change member roles"
  on public.workspace_members for update
  to authenticated
  using (workspace_id in (select private.owned_workspace_ids()))
  with check (workspace_id in (select private.owned_workspace_ids()));

create policy "Owners can remove members and members can leave"
  on public.workspace_members for delete
  to authenticated
  using (
    workspace_id in (select private.owned_workspace_ids())
    or user_id = (select auth.uid())
  );

-- shipments: replace the per-user policies with workspace membership.
drop policy "Users can view their own shipments" on public.shipments;
drop policy "Users can create their own shipments" on public.shipments;

create policy "Members can view their workspace's shipments"
  on public.shipments for select
  to authenticated
  using (workspace_id in (select private.user_workspace_ids()));

create policy "Members can create shipments in their workspace"
  on public.shipments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and workspace_id in (select private.user_workspace_ids())
  );

-- ---------------------------------------------------------------------------
-- Data API privileges. Revoke first: Supabase grants ALL on new public tables
-- by default, and column-level grants only restrict when nothing wider exists.
-- ---------------------------------------------------------------------------

revoke all on public.workspaces from anon, authenticated;
grant select, update (name) on public.workspaces to authenticated;

revoke all on public.workspace_members from anon, authenticated;
grant select, insert, delete, update (role) on public.workspace_members to authenticated;

revoke all on public.shipments from anon, authenticated;
grant select, insert on public.shipments to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create a workspace and become its owner in one transaction.
-- ---------------------------------------------------------------------------

create function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.workspaces (name)
  values (btrim(workspace_name))
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, (select auth.uid()), 'owner');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
