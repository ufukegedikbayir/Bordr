-- Phase 6.5: legally complete commercial invoices.
-- The exporter's legal identity lives on the workspace (company profile) and
-- is copied onto each shipment when it's created, so an issued invoice never
-- changes. The shipment facts (quantities, values, weights, origin, Incoterm,
-- consignee) are entered by the user; the AI only classifies.

-- ---------------------------------------------------------------------------
-- Company profile on workspaces
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column legal_name text check (char_length(legal_name) between 1 and 200),
  add column address_line1 text check (char_length(address_line1) between 1 and 200),
  add column address_line2 text check (char_length(address_line2) between 1 and 200),
  add column postal_code text check (char_length(postal_code) between 1 and 20),
  add column city text check (char_length(city) between 1 and 100),
  add column country_code text check (country_code ~ '^[A-Z]{2}$' and country_code <> 'EU'),
  -- EORI: ISO country prefix + up to 15 alphanumerics, e.g. DE123456789012345.
  add column eori_number text check (eori_number ~ '^[A-Z]{2}[A-Z0-9]{1,15}$'),
  -- VAT ID or other national tax number (e.g. a US EIN), so kept loose.
  add column tax_id text check (tax_id ~ '^[A-Z0-9][A-Z0-9 ./-]{1,29}$'),
  add column signatory_name text check (char_length(signatory_name) between 1 and 120),
  add column signatory_title text check (char_length(signatory_title) between 1 and 120),
  -- Last invoice number issued; only the shipment trigger writes it.
  add column invoice_sequence integer not null default 0 check (invoice_sequence >= 0);

-- Owners already pass the "Owners can rename their workspaces" policy; these
-- grants only widen which columns they may write. invoice_sequence is not granted.
grant update (
  legal_name, address_line1, address_line2, postal_code, city, country_code,
  eori_number, tax_id, signatory_name, signatory_title
) on public.workspaces to authenticated;

-- ---------------------------------------------------------------------------
-- Invoice facts on shipments
-- ---------------------------------------------------------------------------
-- Nullable because shipments created before this phase have none of them; the
-- NOT VALID constraint below makes them mandatory for every new row.

alter table public.shipments
  add column invoice_number text,
  add column quantity integer check (quantity between 1 and 1000000),
  add column unit_price numeric(14, 2) check (unit_price > 0),
  add column currency text check (currency ~ '^[A-Z]{3}$'),
  -- Incoterms 2020 rules valid for any mode of transport (road freight).
  add column incoterm text check (incoterm in ('EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP')),
  add column incoterm_place text check (char_length(incoterm_place) between 1 and 120),
  -- A real country: customs don't accept "EU" as non-preferential origin.
  add column country_of_origin text check (country_of_origin ~ '^[A-Z]{2}$' and country_of_origin <> 'EU'),
  add column package_count integer check (package_count between 1 and 100000),
  add column gross_weight_kg numeric(12, 3) check (gross_weight_kg > 0),
  add column net_weight_kg numeric(12, 3) check (net_weight_kg > 0),
  add column importer_name text check (char_length(importer_name) between 1 and 200),
  add column importer_address text check (char_length(importer_address) between 1 and 400),
  add column importer_tax_id text check (importer_tax_id ~ '^[A-Z0-9][A-Z0-9 ./-]{1,29}$'),
  -- Snapshot of the workspace profile at creation, written by the trigger.
  add column exporter_name text,
  add column exporter_address text,
  add column exporter_country text,
  add column exporter_eori text,
  add column exporter_tax_id text,
  add column signatory_name text,
  add column signatory_title text,
  add constraint shipments_net_weight_within_gross check (net_weight_kg <= gross_weight_kg);

alter table public.shipments
  add constraint shipments_invoice_facts_present check (
    invoice_number is not null
    and quantity is not null
    and unit_price is not null
    and currency is not null
    and incoterm is not null
    and incoterm_place is not null
    and country_of_origin is not null
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

-- Invoice numbers are unique per issuing workspace.
create unique index shipments_workspace_id_invoice_number_key
  on public.shipments (workspace_id, invoice_number);

-- ---------------------------------------------------------------------------
-- Stamp each new shipment with the exporter snapshot and the next invoice number
-- ---------------------------------------------------------------------------
-- Security definer: members (not just owners) create shipments, but only this
-- trigger may advance invoice_sequence. It always overwrites the exporter
-- columns, so a client can't issue an invoice in another company's name.

create function private.stamp_shipment_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.workspaces%rowtype;
  next_number integer;
begin
  -- Locking the workspace row serializes numbering, so two shipments created
  -- at once can't receive the same number or leave a gap.
  select * into profile from public.workspaces w where w.id = new.workspace_id for update;
  if not found then
    raise exception 'Unknown workspace' using errcode = 'foreign_key_violation';
  end if;

  if profile.legal_name is null
    or profile.address_line1 is null
    or profile.postal_code is null
    or profile.city is null
    or profile.country_code is null
    or profile.signatory_name is null
    or (profile.eori_number is null and profile.tax_id is null)
  then
    raise exception 'Complete the company profile before creating shipments'
      using errcode = 'check_violation', hint = 'company_profile_incomplete';
  end if;

  update public.workspaces w
  set invoice_sequence = w.invoice_sequence + 1
  where w.id = new.workspace_id
  returning w.invoice_sequence into next_number;

  new.invoice_number := 'INV-' || to_char(new.created_at at time zone 'UTC', 'YYYY')
    || '-' || lpad(next_number::text, 5, '0');

  new.exporter_name := profile.legal_name;
  new.exporter_address := concat_ws(
    E'\n',
    profile.address_line1,
    profile.address_line2,
    profile.postal_code || ' ' || profile.city
  );
  new.exporter_country := profile.country_code;
  new.exporter_eori := profile.eori_number;
  new.exporter_tax_id := profile.tax_id;
  new.signatory_name := profile.signatory_name;
  new.signatory_title := profile.signatory_title;

  return new;
end;
$$;

revoke all on function private.stamp_shipment_invoice() from public;

create trigger shipments_stamp_invoice
  before insert on public.shipments
  for each row execute function private.stamp_shipment_invoice();
