-- Phase 8: the freight document suite (CMR, packing list, certificate of
-- origin). See docs/CUSTOMS_ARCHITECTURE.md for the legal basis of each field.
--
-- Additive only: every new shipments column is nullable and grouped by an
-- all-or-nothing constraint, so shipments created by earlier app versions
-- (invoice only) keep working.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Multi-line text (addresses): every line must be clean text.
create function private.is_clean_lines(value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select not exists (
    select 1
    from regexp_split_to_table(value, E'\n') as line
    where not private.is_clean_text(line)
  );
$$;

revoke all on function private.is_clean_lines(text) from public;
-- Check constraints run with the writer's privileges (see Phase 6.8).
grant execute on function private.is_clean_lines(text) to authenticated;

-- Registration plates across Europe: "34 ABC 123", "B-AB 1234", "WX 12345".
create function private.is_vehicle_registration(value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select value ~ '^[A-Z0-9]+([ -][A-Z0-9]+)*$' and char_length(value) between 2 and 15;
$$;

revoke all on function private.is_vehicle_registration(text) from public;
grant execute on function private.is_vehicle_registration(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Carriers: each workspace's address book of road hauliers
-- ---------------------------------------------------------------------------

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200 and private.is_clean_text(name)),
  address text not null check (char_length(address) between 1 and 400 and private.is_clean_lines(address)),
  country_code text not null check (country_code ~ '^[A-Z]{2}$' and country_code <> 'EU'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.carriers is 'Road carriers a workspace has shipped with; filled automatically by create_shipment.';

-- One entry per carrier name in a workspace; also serves the picker's sort.
create unique index carriers_workspace_id_name_key on public.carriers (workspace_id, lower(name));

alter table public.carriers enable row level security;

create policy "Members can view their workspace's carriers"
  on public.carriers for select
  to authenticated
  using (workspace_id in (select private.user_workspace_ids()));

create policy "Members can add carriers to their workspace"
  on public.carriers for insert
  to authenticated
  with check (workspace_id in (select private.user_workspace_ids()));

create policy "Members can update their workspace's carriers"
  on public.carriers for update
  to authenticated
  using (workspace_id in (select private.user_workspace_ids()))
  with check (workspace_id in (select private.user_workspace_ids()));

create policy "Owners can delete their workspace's carriers"
  on public.carriers for delete
  to authenticated
  using (workspace_id in (select private.owned_workspace_ids()));

revoke all on public.carriers from anon, authenticated;
grant select, delete on public.carriers to authenticated;
grant insert (workspace_id, name, address, country_code) on public.carriers to authenticated;
grant update (name, address, country_code, updated_at) on public.carriers to authenticated;

-- ---------------------------------------------------------------------------
-- Shipments: transport (CMR) and dangerous goods (ADR) particulars
-- ---------------------------------------------------------------------------

alter table public.shipments
  add column carrier_id uuid references public.carriers (id) on delete set null,
  -- Snapshot: an issued CMR keeps the carrier it named.
  add column carrier_name text check (char_length(carrier_name) between 1 and 200 and private.is_clean_text(carrier_name)),
  add column carrier_address text check (char_length(carrier_address) between 1 and 400 and private.is_clean_lines(carrier_address)),
  add column carrier_country text check (carrier_country ~ '^[A-Z]{2}$' and carrier_country <> 'EU'),
  add column vehicle_registration text check (private.is_vehicle_registration(vehicle_registration)),
  add column trailer_registration text check (private.is_vehicle_registration(trailer_registration)),
  -- CMR Art. 6(1)(d): place and date of taking over, place designated for delivery.
  add column taking_over_place text check (char_length(taking_over_place) between 1 and 200 and private.is_clean_text(taking_over_place)),
  add column taking_over_date date,
  add column delivery_place text check (char_length(delivery_place) between 1 and 200 and private.is_clean_text(delivery_place)),
  -- CMR Art. 6(1)(j): instructions for customs and other formalities.
  add column sender_instructions text check (char_length(sender_instructions) between 1 and 500 and private.is_clean_lines(sender_instructions)),
  -- ADR 5.4.1.1.1: UN number, proper shipping name, label (class), packing group, tunnel code.
  add column adr_un_number text check (adr_un_number ~ '^[0-9]{4}$' and adr_un_number <> '0000'),
  add column adr_shipping_name text check (char_length(adr_shipping_name) between 1 and 200 and private.is_clean_text(adr_shipping_name)),
  add column adr_class text check (adr_class in (
    '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '2.1', '2.2', '2.3', '3', '4.1', '4.2', '4.3',
    '5.1', '5.2', '6.1', '6.2', '7', '8', '9'
  )),
  add column adr_packing_group text check (adr_packing_group in ('I', 'II', 'III')),
  add column adr_tunnel_code text check (adr_tunnel_code in (
    'B', 'B1000C', 'B/D', 'B/E', 'C', 'C5000D', 'C/D', 'C/E', 'D', 'D/E', 'E'
  ));

alter table public.shipments
  -- A CMR needs every one of these, so they're set together or not at all.
  add constraint shipments_transport_complete check (
    num_nonnulls(carrier_name, carrier_address, carrier_country, vehicle_registration,
                 taking_over_place, taking_over_date, delivery_place) in (0, 7)
    and (vehicle_registration is not null or (trailer_registration is null and sender_instructions is null))
  ),
  -- The goods are taken over around the time the documents are issued.
  add constraint shipments_taking_over_date_plausible check (
    taking_over_date between (created_at at time zone 'UTC')::date - 30
                         and (created_at at time zone 'UTC')::date + 90
  ),
  add constraint shipments_adr_complete check (
    num_nonnulls(adr_un_number, adr_shipping_name, adr_class) in (0, 3)
    and (adr_un_number is not null or (adr_packing_group is null and adr_tunnel_code is null))
  ),
  -- Lets shipment_packages reference (shipment, workspace) together, so a
  -- package can never point at a shipment in another workspace.
  add constraint shipments_id_workspace_id_key unique (id, workspace_id);

-- ---------------------------------------------------------------------------
-- Packages: one row per pallet or package (packing list, CMR boxes 6-12)
-- ---------------------------------------------------------------------------

create table public.shipment_packages (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null,
  workspace_id uuid not null,
  position smallint not null check (position between 1 and 99),
  package_type text not null check (package_type in (
    'eur_pallet', 'pallet', 'crate', 'carton', 'drum', 'ibc', 'bag', 'other'
  )),
  -- Marks and numbers as printed on the package labels (CMR box 6).
  marks text not null check (char_length(marks) between 1 and 60 and private.is_clean_text(marks)),
  quantity integer not null check (quantity between 1 and 1000000),
  net_weight_kg numeric(12, 3) not null check (net_weight_kg > 0),
  gross_weight_kg numeric(12, 3) not null check (gross_weight_kg > 0 and gross_weight_kg <= 30000),
  -- Centimetres, bounded by a standard semi-trailer (13.6 m × 2.48 m × 2.7 m),
  -- which also catches millimetres typed by mistake.
  length_cm integer not null check (length_cm between 1 and 1400),
  width_cm integer not null check (width_cm between 1 and 260),
  height_cm integer not null check (height_cm between 1 and 300),
  check (net_weight_kg <= gross_weight_kg),
  unique (shipment_id, position),
  foreign key (shipment_id, workspace_id) references public.shipments (id, workspace_id) on delete cascade
);

comment on table public.shipment_packages is 'Packages of a shipment. Written only by create_shipment, so issued documents cannot change.';

alter table public.shipment_packages enable row level security;

create policy "Members can view their workspace's packages"
  on public.shipment_packages for select
  to authenticated
  using (workspace_id in (select private.user_workspace_ids()));

-- No insert, update or delete for clients: create_shipment is the only writer.
revoke all on public.shipment_packages from anon, authenticated;
grant select on public.shipment_packages to authenticated;

-- ---------------------------------------------------------------------------
-- create_shipment: shipment, carrier and packages in one transaction
-- ---------------------------------------------------------------------------
-- Security definer so it can write packages, which clients can't. It must
-- therefore check everything RLS would: the session and workspace membership.
-- Totals are computed here from the packages, never taken from the client,
-- so the invoice, packing list and CMR can't disagree.

create function public.create_shipment(shipment jsonb, packages jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_workspace uuid;
  new_carrier_id uuid;
  new_shipment_id uuid;
  package_total integer;
  total_quantity bigint;
  total_net numeric;
  total_gross numeric;
  total_volume_m3 numeric;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  target_workspace := (shipment ->> 'workspace_id')::uuid;
  if target_workspace is null or target_workspace not in (select private.user_workspace_ids()) then
    raise exception 'Not a member of this workspace'
      using errcode = 'insufficient_privilege', hint = 'not_a_member';
  end if;

  if jsonb_typeof(packages) is distinct from 'array'
    or jsonb_array_length(packages) not between 1 and 99
  then
    raise exception 'A shipment needs 1 to 99 packages'
      using errcode = 'check_violation', hint = 'packages_count';
  end if;

  select
    count(*),
    sum((p ->> 'quantity')::integer),
    sum((p ->> 'net_weight_kg')::numeric),
    sum((p ->> 'gross_weight_kg')::numeric),
    sum((p ->> 'length_cm')::numeric * (p ->> 'width_cm')::numeric * (p ->> 'height_cm')::numeric) / 1000000
  into package_total, total_quantity, total_net, total_gross, total_volume_m3
  from jsonb_array_elements(packages) as p;

  -- One CMR per vehicle (CMR Art. 5(2)): a shipment is one truck's load.
  if total_gross > 30000 then
    raise exception 'Gross weight exceeds one truck''s payload (30,000 kg)'
      using errcode = 'check_violation', hint = 'payload_weight';
  end if;
  if total_volume_m3 > 120 then
    raise exception 'Volume exceeds one truck''s capacity (120 m3)'
      using errcode = 'check_violation', hint = 'payload_volume';
  end if;

  insert into public.carriers (workspace_id, name, address, country_code)
  values (
    target_workspace,
    shipment ->> 'carrier_name',
    shipment ->> 'carrier_address',
    shipment ->> 'carrier_country'
  )
  on conflict (workspace_id, (lower(name))) do update
    set name = excluded.name,
        address = excluded.address,
        country_code = excluded.country_code,
        updated_at = now()
  returning id into new_carrier_id;

  -- Explicit columns only: a field added to shipments later never becomes
  -- writable through this function by accident. The invoice trigger adds the
  -- invoice number and the exporter snapshot.
  insert into public.shipments (
    user_id, workspace_id, description, country, hs_code, hs_description, estimated_duty, documents,
    quantity, unit_price, currency, incoterm, incoterm_place, country_of_origin,
    package_count, gross_weight_kg, net_weight_kg,
    importer_name, importer_address, importer_tax_id,
    carrier_id, carrier_name, carrier_address, carrier_country,
    vehicle_registration, trailer_registration,
    taking_over_place, taking_over_date, delivery_place, sender_instructions,
    adr_un_number, adr_shipping_name, adr_class, adr_packing_group, adr_tunnel_code
  )
  values (
    caller,
    target_workspace,
    shipment ->> 'description',
    shipment ->> 'country',
    shipment ->> 'hs_code',
    shipment ->> 'hs_description',
    shipment ->> 'estimated_duty',
    coalesce(array(select jsonb_array_elements_text(shipment -> 'documents')), '{}'),
    total_quantity,
    (shipment ->> 'unit_price')::numeric,
    shipment ->> 'currency',
    shipment ->> 'incoterm',
    shipment ->> 'incoterm_place',
    shipment ->> 'country_of_origin',
    package_total,
    total_gross,
    total_net,
    shipment ->> 'importer_name',
    shipment ->> 'importer_address',
    shipment ->> 'importer_tax_id',
    new_carrier_id,
    shipment ->> 'carrier_name',
    shipment ->> 'carrier_address',
    shipment ->> 'carrier_country',
    shipment ->> 'vehicle_registration',
    shipment ->> 'trailer_registration',
    shipment ->> 'taking_over_place',
    (shipment ->> 'taking_over_date')::date,
    shipment ->> 'delivery_place',
    shipment ->> 'sender_instructions',
    shipment ->> 'adr_un_number',
    shipment ->> 'adr_shipping_name',
    shipment ->> 'adr_class',
    shipment ->> 'adr_packing_group',
    shipment ->> 'adr_tunnel_code'
  )
  returning id into new_shipment_id;

  -- Positions follow the array order, so the client can't leave gaps.
  insert into public.shipment_packages (
    shipment_id, workspace_id, position, package_type, marks, quantity,
    net_weight_kg, gross_weight_kg, length_cm, width_cm, height_cm
  )
  select
    new_shipment_id,
    target_workspace,
    p.ordinality,
    p.value ->> 'package_type',
    p.value ->> 'marks',
    (p.value ->> 'quantity')::integer,
    (p.value ->> 'net_weight_kg')::numeric,
    (p.value ->> 'gross_weight_kg')::numeric,
    (p.value ->> 'length_cm')::integer,
    (p.value ->> 'width_cm')::integer,
    (p.value ->> 'height_cm')::integer
  from jsonb_array_elements(packages) with ordinality as p (value, ordinality);

  return new_shipment_id;
end;
$$;

revoke all on function public.create_shipment(jsonb, jsonb) from public, anon;
grant execute on function public.create_shipment(jsonb, jsonb) to authenticated;
