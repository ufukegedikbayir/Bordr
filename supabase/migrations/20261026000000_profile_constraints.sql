-- Phase 6.8: enforce the legal profile rules in the database, not only in the
-- app. The settings form already applies the same rules; these constraints
-- stop anything that bypasses it (direct API calls with an owner's session).
-- EORI and country formats were already enforced in Phase 6.5.

-- ---------------------------------------------------------------------------
-- Clean text: what a name or address on a customs document may contain
-- ---------------------------------------------------------------------------
-- A deny-list rather than an allow-list: Postgres character classes beyond
-- ASCII depend on the server locale, while these code-point ranges don't.

create function private.is_clean_text(value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select value = btrim(value)
    and value !~ '\s\s'
    -- Starts with a letter or digit, not punctuation or a space.
    and value !~ '^[[:space:][:punct:]]'
    and value !~ '[[:cntrl:]]'
    -- ASCII symbols no registered name or address needs.
    and value !~ '[!"$%*;<=>?@\[\\\]^_`{|}~]'
    -- (c), (r), currency and letterlike symbols, arrows, maths, technical,
    -- box drawing, shapes, dingbats, zero-width and joiner characters,
    -- private use, variation selectors, emoji and pictographs, tag characters.
    and value !~ '[©®​-‏⁠-⁯₠-⃏℀-⅏←-⯿-︀-️\U0001F000-\U0001FAFF\U000E0000-\U000E007F]'
$$;

revoke all on function private.is_clean_text(text) from public;
-- Check constraints run with the privileges of whoever writes the row, so
-- owners saving their profile need EXECUTE. It only inspects its argument.
grant execute on function private.is_clean_text(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Clean up existing rows so the constraints apply to every row
-- ---------------------------------------------------------------------------
-- Invalid values become NULL. That leaves the profile incomplete, so the app
-- asks the owner to re-enter it before the next invoice; it never prints a
-- placeholder as the exporter's legal identity. Issued invoices are untouched:
-- they keep their own snapshot on the shipment.

-- 1. Normalise what can be saved: trim, collapse spaces, fix case.
update public.workspaces
set
  legal_name = nullif(regexp_replace(btrim(legal_name), '\s+', ' ', 'g'), ''),
  address_line1 = nullif(regexp_replace(btrim(address_line1), '\s+', ' ', 'g'), ''),
  address_line2 = nullif(regexp_replace(btrim(address_line2), '\s+', ' ', 'g'), ''),
  postal_code = nullif(upper(regexp_replace(btrim(postal_code), '\s+', ' ', 'g')), ''),
  city = nullif(regexp_replace(btrim(city), '\s+', ' ', 'g'), ''),
  eori_number = nullif(upper(regexp_replace(eori_number, '\s', '', 'g')), ''),
  tax_id = nullif(upper(regexp_replace(btrim(tax_id), '\s+', ' ', 'g')), ''),
  signatory_name = nullif(regexp_replace(btrim(signatory_name), '\s+', ' ', 'g'), ''),
  signatory_title = nullif(regexp_replace(btrim(signatory_title), '\s+', ' ', 'g'), '');

-- 2. Clear what can't be right: values the constraints below reject,
--    keyboard filler (one letter repeated, e.g. "gggggg"), and the example
--    numbers shown in the settings form being saved as if they were real.
update public.workspaces
set
  legal_name = case when private.is_clean_text(legal_name) and legal_name !~* '^([a-z])\1{2,}$' then legal_name end,
  address_line1 = case when private.is_clean_text(address_line1) and address_line1 !~* '^([a-z])\1{2,}$' then address_line1 end,
  address_line2 = case when private.is_clean_text(address_line2) and address_line2 !~* '^([a-z])\1{2,}$' then address_line2 end,
  postal_code = case
    when postal_code ~ '^[A-Z0-9]+([ -][A-Z0-9]+)*$' and char_length(postal_code) between 2 and 10
      and postal_code !~ '^([A-Z])\1+$'
    then postal_code
  end,
  city = case when private.is_clean_text(city) and city !~ '^[0-9]' and city !~* '^([a-z])\1{2,}$' then city end,
  eori_number = case
    when eori_number ~ '^[A-Z]{2}[A-Z0-9]{1,15}$' and eori_number <> 'DE123456789012345' then eori_number
  end,
  tax_id = case
    when tax_id ~ '^[A-Z0-9]+([ ./-][A-Z0-9]+)*$' and char_length(tax_id) between 2 and 30 and tax_id <> 'DE123456789'
    then tax_id
  end,
  signatory_name = case
    when private.is_clean_text(signatory_name) and signatory_name !~ '[0-9]' and signatory_name !~* '^([a-z])\1{2,}$'
    then signatory_name
  end,
  signatory_title = case when private.is_clean_text(signatory_title) and signatory_title !~* '^([a-z])\1{2,}$' then signatory_title end;

-- ---------------------------------------------------------------------------
-- Constraints (in addition to the length checks from Phase 6.5)
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add constraint workspaces_legal_name_clean check (private.is_clean_text(legal_name)),
  add constraint workspaces_address_line1_clean check (private.is_clean_text(address_line1)),
  add constraint workspaces_address_line2_clean check (private.is_clean_text(address_line2)),
  add constraint workspaces_city_clean check (private.is_clean_text(city) and city !~ '^[0-9]'),
  -- 2 to 10 letters or digits, single spaces or dashes between them: 10115, SW1A 1AA, 1010-001.
  add constraint workspaces_postal_code_format check (
    postal_code ~ '^[A-Z0-9]+([ -][A-Z0-9]+)*$' and char_length(postal_code) between 2 and 10
  ),
  -- Separators only between characters, never doubled: DE 123.456/78, not DE--123.
  add constraint workspaces_tax_id_format check (
    tax_id ~ '^[A-Z0-9]+([ ./-][A-Z0-9]+)*$' and char_length(tax_id) between 2 and 30
  ),
  add constraint workspaces_signatory_name_clean check (
    private.is_clean_text(signatory_name) and signatory_name !~ '[0-9]'
  ),
  add constraint workspaces_signatory_title_clean check (private.is_clean_text(signatory_title));
