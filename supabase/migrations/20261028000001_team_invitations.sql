-- Phase 9: team invitations. Owners invite people by email; the invitee joins
-- by opening a link that carries a secret token and accepting while signed in
-- with that email address.
--
-- Security model:
-- - The link carries a random 256-bit token. Only its SHA-256 hash is stored,
--   so a leaked table (or a backup) can't be used to join a workspace.
-- - Accepting requires a session whose confirmed email is the invited one: a
--   forwarded or intercepted link is useless to anyone else.
-- - Joining a workspace now always goes through an invitation. Owners can no
--   longer insert members directly, which let them add any user by id without
--   that user's consent.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Stored lower-cased and trimmed, so one address can't be invited twice in
  -- different spellings.
  email text not null check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  role text not null default 'member' check (role in ('owner', 'member')),
  -- Hex SHA-256 of the token in the link. The token itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- "expired" is written lazily, when the same address is invited again; a
  -- pending row past expires_at is treated as expired everywhere.
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_at is not null))
);

comment on table public.workspace_invitations is 'Pending and past invitations to join a workspace. Written only by the invitation functions.';

-- One open invitation per address and workspace.
create unique index workspace_invitations_one_pending_key
  on public.workspace_invitations (workspace_id, email)
  where status = 'pending';

-- Serves the team page: a workspace's invitations, newest first.
create index workspace_invitations_workspace_id_created_at_idx
  on public.workspace_invitations (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: owners see and revoke their workspace's invitations.
-- Creating and accepting go through the functions below.
-- ---------------------------------------------------------------------------

alter table public.workspace_invitations enable row level security;

create policy "Owners can view their workspace's invitations"
  on public.workspace_invitations for select
  to authenticated
  using (workspace_id in (select private.owned_workspace_ids()));

create policy "Owners can revoke pending invitations"
  on public.workspace_invitations for delete
  to authenticated
  using (workspace_id in (select private.owned_workspace_ids()) and status = 'pending');

-- token_hash stays unreadable even to owners: it's only ever compared.
revoke all on public.workspace_invitations from anon, authenticated;
grant select (id, workspace_id, email, role, status, invited_by, created_at, expires_at, accepted_at)
  on public.workspace_invitations to authenticated;
grant delete on public.workspace_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- Membership only through invitations
-- ---------------------------------------------------------------------------

drop policy "Owners can add members" on public.workspace_members;
revoke insert on public.workspace_members from authenticated;

-- ---------------------------------------------------------------------------
-- Helper: the hash the table stores, from the token in the link
-- ---------------------------------------------------------------------------

create function private.invitation_token_hash(token text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;

revoke all on function private.invitation_token_hash(text) from public;

-- ---------------------------------------------------------------------------
-- create_workspace_invitation: owners only
-- ---------------------------------------------------------------------------
-- The server generates the token and sends only its hash, so the token never
-- reaches the database or its logs.

create function public.create_workspace_invitation(
  target_workspace uuid,
  invitee_email text,
  invitee_role text,
  hashed_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  normalized_email text := lower(btrim(invitee_email));
  new_invitation_id uuid;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  if target_workspace is null or target_workspace not in (select private.owned_workspace_ids()) then
    raise exception 'Only an owner of this workspace can invite people'
      using errcode = 'insufficient_privilege', hint = 'not_owner';
  end if;

  if invitee_role is null or invitee_role not in ('owner', 'member') then
    raise exception 'Unknown role' using errcode = 'check_violation', hint = 'invalid_role';
  end if;

  if exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = target_workspace and lower(u.email) = normalized_email
  ) then
    raise exception 'Already a member of this workspace'
      using errcode = 'unique_violation', hint = 'already_member';
  end if;

  -- An expired invitation no longer blocks a new one.
  update public.workspace_invitations i
  set status = 'expired'
  where i.workspace_id = target_workspace
    and i.email = normalized_email
    and i.status = 'pending'
    and i.expires_at <= now();

  -- Invitations will be emailed: cap how many one workspace can have open.
  if (
    select count(*) from public.workspace_invitations i
    where i.workspace_id = target_workspace and i.status = 'pending' and i.expires_at > now()
  ) >= 50 then
    raise exception 'Too many open invitations' using errcode = 'check_violation', hint = 'too_many_invitations';
  end if;

  begin
    insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by)
    values (target_workspace, normalized_email, invitee_role, hashed_token, caller)
    returning id into new_invitation_id;
  exception when unique_violation then
    raise exception 'This address already has an open invitation'
      using errcode = 'unique_violation', hint = 'already_invited';
  end;

  return new_invitation_id;
end;
$$;

revoke all on function public.create_workspace_invitation(uuid, text, text, text) from public, anon;
grant execute on function public.create_workspace_invitation(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_workspace_invitation: what the invite page shows
-- ---------------------------------------------------------------------------
-- Open to signed-out visitors, so the page can say which workspace and which
-- address before they sign in. Knowing the token is the authorization: it is
-- 256 random bits and only ever sent to the invitee.

create function public.get_workspace_invitation(token text)
returns table (workspace_name text, email text, role text, status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.name,
    i.email,
    i.role,
    case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
    i.expires_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = private.invitation_token_hash(token);
$$;

revoke all on function public.get_workspace_invitation(text) from public;
grant execute on function public.get_workspace_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_workspace_invitation: the invitee joins
-- ---------------------------------------------------------------------------

create function public.accept_workspace_invitation(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  invitation public.workspace_invitations%rowtype;
  caller_email text;
  caller_confirmed timestamptz;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  -- Locked, so a link opened twice at once joins once.
  select * into invitation
  from public.workspace_invitations i
  where i.token_hash = private.invitation_token_hash(token)
  for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'no_data_found', hint = 'invalid_token';
  end if;

  if invitation.status = 'accepted' then
    -- Opening the link again after joining is harmless.
    if invitation.accepted_by = caller then
      return invitation.workspace_id;
    end if;
    raise exception 'Invitation already used' using errcode = 'check_violation', hint = 'already_used';
  end if;

  if invitation.status = 'expired' or invitation.expires_at <= now() then
    raise exception 'Invitation expired' using errcode = 'check_violation', hint = 'expired';
  end if;

  select lower(u.email), u.email_confirmed_at into caller_email, caller_confirmed
  from auth.users u
  where u.id = caller;

  if caller_email is distinct from invitation.email then
    raise exception 'This invitation is for a different email address'
      using errcode = 'insufficient_privilege', hint = 'wrong_account';
  end if;
  if caller_confirmed is null then
    raise exception 'Confirm your email address first'
      using errcode = 'insufficient_privilege', hint = 'email_unconfirmed';
  end if;

  -- An owner invitation upgrades an existing membership; a member invitation
  -- never downgrades one.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, caller, invitation.role)
  on conflict (workspace_id, user_id) do update
    set role = 'owner'
    where excluded.role = 'owner';

  update public.workspace_invitations i
  set status = 'accepted', accepted_by = caller, accepted_at = now()
  where i.id = invitation.id;

  return invitation.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invitation(text) from public, anon;
grant execute on function public.accept_workspace_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- workspace_team: members with their email addresses, for the team page
-- ---------------------------------------------------------------------------
-- Emails live in auth.users, which clients can't read. Members may see who
-- else is in their workspace, as they already can through workspace_members.

create function public.workspace_team(target_workspace uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = target_workspace
    and target_workspace in (select private.user_workspace_ids())
  order by m.role = 'owner' desc, m.created_at, u.email;
$$;

revoke all on function public.workspace_team(uuid) from public, anon;
grant execute on function public.workspace_team(uuid) to authenticated;
