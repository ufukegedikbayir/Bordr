-- Phase 8.2: multi-line shipments. A consolidated load carries several kinds
-- of goods, each with its own description, HS code, origin and price, so the
-- goods move from shipments into shipment_lines. See docs/CUSTOMS_ARCHITECTURE.md.
--
-- Runs as one transaction in the SQL Editor:
--   1. create shipment_lines;
--   2. copy every shipment's single line into it;
--   3. link each package to the line it carries;
--   4. replace create_shipment with a version that takes lines;
--   5. drop the single-line columns from shipments.
-- The app version that ships with this migration reads only the new shape.

-- ---------------------------------------------------------------------------
-- 1. Lines: one row per invoice line
-- ---------------------------------------------------------------------------

create table public.shipment_lines (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null,
  workspace_id uuid not null,
  -- Item number on every document (invoice line, packing list, certificate).
  position smallint not null check (position between 1 and 30),
  description text not null check (char_length(description) between 1 and 500),
  hs_code text not null check (hs_code ~ '^[0-9]{4}\.[0-9]{2}$'),
  hs_description text not null,
  estimated_duty text not null,
  -- Invoice facts. Computed from the line's packages by create_shipment.
  quantity integer check (quantity between 1 and 1000000),
  unit_price numeric(14, 2) check (unit_price > 0),
  -- A real country: customs don't accept "EU" as non-preferential origin.
  origin_country text check (origin_country ~ '^[A-Z]{2}$' and origin_country <> 'EU'),
  net_weight_kg numeric(12, 3) check (net_weight_kg > 0),
  gross_weight_kg numeric(12, 3) check (gross_weight_kg > 0),
  -- Shipments from before invoices (Phase 5) had a classification only.
  constraint shipment_lines_invoice_facts check (
    num_nonnulls(quantity, unit_price, origin_country, net_weight_kg, gross_weight_kg) in (0, 5)
  ),
  check (net_weight_kg <= gross_weight_kg),
  unique (shipment_id, position),
  -- (shipment, workspace) together, so a line can never point at a shipment
  -- in another workspace.
  foreign key (shipment_id, workspace_id) references public.shipments (id, workspace_id) on delete cascade
);

comment on table public.shipment_lines is 'Invoice lines of a shipment. Written only by create_shipment, so issued documents cannot change.';

alter table public.shipment_lines enable row level security;

create policy "Members can view their workspace's lines"
  on public.shipment_lines for select
  to authenticated
  using (workspace_id in (select private.user_workspace_ids()));

-- No insert, update or delete for clients: create_shipment is the only writer.
revoke all on public.shipment_lines from anon, authenticated;
grant select on public.shipment_lines to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Copy each existing shipment's single line
-- ---------------------------------------------------------------------------
-- Invoice facts are copied only when all of them exist (shipments from
-- Phase 6.5 on); earlier rows keep just their classification. A single-line
-- shipment's weights are the line's weights.

insert into public.shipment_lines (
  shipment_id, workspace_id, position, description, hs_code, hs_description, estimated_duty,
  quantity, unit_price, origin_country, net_weight_kg, gross_weight_kg
)
select
  s.id,
  s.workspace_id,
  1,
  s.description,
  s.hs_code,
  s.hs_description,
  s.estimated_duty,
  case when f.complete then s.quantity end,
  case when f.complete then s.unit_price end,
  case when f.complete then s.country_of_origin end,
  case when f.complete then s.net_weight_kg end,
  case when f.complete then s.gross_weight_kg end
from public.shipments s
cross join lateral (
  select num_nonnulls(s.quantity, s.unit_price, s.country_of_origin, s.net_weight_kg, s.gross_weight_kg) = 5 as complete
) f;

-- ---------------------------------------------------------------------------
-- 3. Each package carries one line's goods
-- ---------------------------------------------------------------------------
-- That keeps one HS code per package on the packing list and lets each line's
-- quantity and weights be computed from its packages. Existing packages all
-- belong to line 1, the only line their shipments had.

alter table public.shipment_packages add column line_position smallint;

update public.shipment_packages set line_position = 1;

alter table public.shipment_packages
  alter column line_position set not null,
  add constraint shipment_packages_line_fkey
    foreign key (shipment_id, line_position)
    references public.shipment_lines (shipment_id, position)
    on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. create_shipment: shipment, carrier, lines and packages in one transaction
-- ---------------------------------------------------------------------------
-- Security definer so it can write lines and packages, which clients can't.
-- It must therefore check everything RLS would: the session and workspace
-- membership. Quantities, weights and package counts are computed here from
-- the packages, never taken from the client, so the invoice, packing list,
-- CMR and certificate of origin can't disagree.

drop function public.create_shipment(jsonb, jsonb);

create function public.create_shipment(shipment jsonb, lines jsonb, packages jsonb)
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
  line_total integer;
  package_total integer;
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

  if jsonb_typeof(lines) is distinct from 'array'
    or jsonb_array_length(lines) not between 1 and 30
  then
    raise exception 'A shipment needs 1 to 30 lines'
      using errcode = 'check_violation', hint = 'lines_count';
  end if;
  line_total := jsonb_array_length(lines);

  if jsonb_typeof(packages) is distinct from 'array'
    or jsonb_array_length(packages) not between 1 and 99
  then
    raise exception 'A shipment needs 1 to 99 packages'
      using errcode = 'check_violation', hint = 'packages_count';
  end if;

  -- Every package names an existing line, and every line has a package.
  if exists (
    select 1 from jsonb_array_elements(packages) as p
    where (p ->> 'line') is null or (p ->> 'line')::integer not between 1 and line_total
  ) then
    raise exception 'Every package must belong to one of the shipment''s lines'
      using errcode = 'check_violation', hint = 'package_line';
  end if;
  if exists (
    select 1 from generate_series(1, line_total) as l (n)
    where not exists (
      select 1 from jsonb_array_elements(packages) as p where (p ->> 'line')::integer = l.n
    )
  ) then
    raise exception 'Every line needs at least one package'
      using errcode = 'check_violation', hint = 'line_without_packages';
  end if;

  -- Rounded as the package columns store them, so the totals equal the sum
  -- of what the documents print.
  select
    count(*),
    sum(round((p ->> 'net_weight_kg')::numeric, 3)),
    sum(round((p ->> 'gross_weight_kg')::numeric, 3)),
    sum((p ->> 'length_cm')::numeric * (p ->> 'width_cm')::numeric * (p ->> 'height_cm')::numeric) / 1000000
  into package_total, total_net, total_gross, total_volume_m3
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
    user_id, workspace_id, country, documents,
    currency, incoterm, incoterm_place,
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
    shipment ->> 'country',
    coalesce(array(select jsonb_array_elements_text(shipment -> 'documents')), '{}'),
    shipment ->> 'currency',
    shipment ->> 'incoterm',
    shipment ->> 'incoterm_place',
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

  -- Positions follow the array order, so the client can't leave gaps. Each
  -- line's quantity and weights are the sums of its packages.
  insert into public.shipment_lines (
    shipment_id, workspace_id, position, description, hs_code, hs_description, estimated_duty,
    quantity, unit_price, origin_country, net_weight_kg, gross_weight_kg
  )
  select
    new_shipment_id,
    target_workspace,
    l.ordinality,
    l.value ->> 'description',
    l.value ->> 'hs_code',
    l.value ->> 'hs_description',
    l.value ->> 'estimated_duty',
    agg.quantity,
    (l.value ->> 'unit_price')::numeric,
    l.value ->> 'origin_country',
    agg.net,
    agg.gross
  from jsonb_array_elements(lines) with ordinality as l (value, ordinality)
  cross join lateral (
    select
      sum((p ->> 'quantity')::integer) as quantity,
      sum(round((p ->> 'net_weight_kg')::numeric, 3)) as net,
      sum(round((p ->> 'gross_weight_kg')::numeric, 3)) as gross
    from jsonb_array_elements(packages) as p
    where (p ->> 'line')::integer = l.ordinality
  ) agg;

  insert into public.shipment_packages (
    shipment_id, workspace_id, position, line_position, package_type, marks, quantity,
    net_weight_kg, gross_weight_kg, length_cm, width_cm, height_cm
  )
  select
    new_shipment_id,
    target_workspace,
    p.ordinality,
    (p.value ->> 'line')::smallint,
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

revoke all on function public.create_shipment(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_shipment(jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Drop the single-line columns from shipments
-- ---------------------------------------------------------------------------
-- The Phase 6.5 rule that invoice facts are present names three of them, so
-- it's replaced by the same rule minus the columns that moved to the lines.
-- NOT VALID as before: shipments from before invoices are exempt.

alter table public.shipments drop constraint shipments_invoice_facts_present;

alter table public.shipments
  drop column description,
  drop column hs_code,
  drop column hs_description,
  drop column estimated_duty,
  drop column quantity,
  drop column unit_price,
  drop column country_of_origin;

alter table public.shipments
  add constraint shipments_invoice_facts_present check (
    invoice_number is not null
    and currency is not null
    and incoterm is not null
    and incoterm_place is not null
    and package_count is not null
    and gross_weight_kg is not null
    and net_weight_kg is not null
    and importer_name is not null
    and importer_address is not null
    and exporter_name is not null
    and exporter_address is not null
    and exporter_country is not null
    and (exporter_eori is not null or exporter_tax_id is not null)
    and signatory_name is not null
  ) not valid;

-- A shipment without lines would be an invoice for nothing: create_shipment
-- is now the only way to create one.
revoke insert on public.shipments from authenticated;
drop policy "Members can create shipments in their workspace" on public.shipments;
