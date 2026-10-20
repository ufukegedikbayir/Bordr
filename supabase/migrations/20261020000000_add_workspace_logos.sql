-- Phase 6.4: workspace logos for white-labelled invoices.
-- Files live at workspace_assets/<workspace id>/<file>; the first path segment
-- decides who may write.

-- ---------------------------------------------------------------------------
-- workspaces.logo_url
-- ---------------------------------------------------------------------------

-- Only a public URL inside this workspace's own folder of the bucket, so an
-- owner can't point invoices at an arbitrary server (the app also checks the host).
alter table public.workspaces
  add column logo_url text
  check (
    logo_url is null
    or (
      char_length(logo_url) <= 1024
      and position('/storage/v1/object/public/workspace_assets/' || id::text || '/' in logo_url) > 0
    )
  );

comment on column public.workspaces.logo_url is 'Public URL of the workspace logo in the workspace_assets bucket, shown on invoices.';

-- The existing "Owners can rename their workspaces" policy already limits
-- updates to owners; this only widens which column they may write.
grant update (logo_url) on public.workspaces to authenticated;

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

-- Public: files are served by URL with no policy, which is what "anyone can
-- read" means here. PNG and JPEG only: the PDF renderer can't draw SVG or
-- WebP, and SVG in a public bucket is a script-injection risk.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace_assets', 'workspace_assets', true, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- storage.objects policies: owners manage their workspace's folder.
-- ---------------------------------------------------------------------------
-- There is deliberately no public SELECT policy: public URLs don't need one,
-- and one would let anyone list every workspace's files through the API.
-- Owners get SELECT on their own folder because removing and overwriting
-- files require it.

create policy "Workspace owners can view their assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workspace_assets'
    and (storage.foldername(name))[1] in (select ws::text from private.owned_workspace_ids() as ws)
  );

create policy "Workspace owners can upload assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workspace_assets'
    and (storage.foldername(name))[1] in (select ws::text from private.owned_workspace_ids() as ws)
  );

create policy "Workspace owners can replace assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'workspace_assets'
    and (storage.foldername(name))[1] in (select ws::text from private.owned_workspace_ids() as ws)
  )
  with check (
    bucket_id = 'workspace_assets'
    and (storage.foldername(name))[1] in (select ws::text from private.owned_workspace_ids() as ws)
  );

create policy "Workspace owners can delete assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workspace_assets'
    and (storage.foldername(name))[1] in (select ws::text from private.owned_workspace_ids() as ws)
  );
