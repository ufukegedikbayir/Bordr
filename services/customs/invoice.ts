// The commercial invoice data model, shared by the Server Actions, the form
// and the PDF. No server-only imports: this ships to the browser too.
import { z } from "zod";

import { COUNTRIES, MAX_DESCRIPTION_LENGTH, type CountryCode } from "./constants";
import { COUNTRY_NAMES } from "./countries";

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/** Incoterms® 2020 rules usable for any mode of transport, i.e. valid for road freight. */
export const INCOTERMS = [
  { code: "EXW", name: "Ex Works" },
  { code: "FCA", name: "Free Carrier" },
  { code: "CPT", name: "Carriage Paid To" },
  { code: "CIP", name: "Carriage and Insurance Paid To" },
  { code: "DAP", name: "Delivered at Place" },
  { code: "DPU", name: "Delivered at Place Unloaded" },
  { code: "DDP", name: "Delivered Duty Paid" },
] as const;

export type Incoterm = (typeof INCOTERMS)[number]["code"];

export const CURRENCIES = ["EUR", "USD", "GBP", "CAD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "TRY"] as const;

export type Currency = (typeof CURRENCIES)[number];

/** English name of any ISO country code, e.g. "PL" -> "Poland". */
export function regionName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

/** Every country, sorted by English name, for origin and address pickers. */
export const WORLD_COUNTRIES = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

export function isIsoCountry(code: string): boolean {
  return Object.hasOwn(COUNTRY_NAMES, code);
}

// ---------------------------------------------------------------------------
// Shipment input: what the user declares. Validated in the form and again on the server.
// ---------------------------------------------------------------------------

export const TAX_ID_PATTERN = /^[A-Z0-9][A-Z0-9 ./-]{1,29}$/;
export const EORI_PATTERN = /^[A-Z]{2}[A-Z0-9]{1,15}$/;

const required = (what: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${what}.`)
    .max(max, `Keep ${what} under ${max} characters.`);

/** Accepts "1 234,5" or "1234.5" style input; rounds to `decimals`. */
const amount = (what: string, decimals: number, max: number) =>
  z.preprocess(
    // Blank becomes undefined so it reads "Enter …" rather than "must be more than zero".
    (value) =>
      typeof value === "string" ? value.replace(/\s/g, "").replace(",", ".") || undefined : value,
    z.coerce
      .number({ error: `Enter ${what}.` })
      .refine(Number.isFinite, `Enter ${what}.`)
      .refine((v) => v > 0, `${what[0]!.toUpperCase()}${what.slice(1)} must be more than zero.`)
      .refine((v) => v <= max, `That ${what} is too large.`)
      .transform((v) => Number(v.toFixed(decimals))),
  );

const count = (what: string, max: number) =>
  z.coerce
    .number({ error: `Enter ${what}.` })
    .int(`Enter ${what} as a whole number.`)
    .min(1, `Enter ${what}.`)
    .max(max, `That ${what} is too large.`);

const destinationCodes = COUNTRIES.map(({ code }) => code) as [CountryCode, ...CountryCode[]];

export const shipmentInputSchema = z
  .object({
    description: required("a product description", MAX_DESCRIPTION_LENGTH),
    country: z.enum(destinationCodes, { error: "Choose a supported destination country." }),
    consigneeName: required("the consignee's name", 200),
    consigneeAddress: required("the consignee's address", 400),
    consigneeTaxId: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || TAX_ID_PATTERN.test(v), "Use letters, digits, spaces, dots, slashes or dashes."),
    quantity: count("the quantity", 1_000_000),
    unitPrice: amount("the unit price", 2, 1_000_000_000),
    currency: z.enum(CURRENCIES, { error: "Choose a currency." }),
    incoterm: z.enum(INCOTERMS.map(({ code }) => code) as [Incoterm, ...Incoterm[]], {
      error: "Choose an Incoterm.",
    }),
    incotermPlace: required("the named place", 120),
    originCountry: z
      .string()
      .refine((v) => isIsoCountry(v) && v !== "EU", "Choose the country where the goods were made."),
    packageCount: count("the number of packages", 100_000),
    grossWeightKg: amount("the gross weight", 3, 1_000_000),
    netWeightKg: amount("the net weight", 3, 1_000_000),
  })
  .refine((v) => v.netWeightKg <= v.grossWeightKg, {
    path: ["netWeightKg"],
    message: "Net weight can't be more than the gross weight.",
  });

export type ShipmentInput = z.output<typeof shipmentInputSchema>;
/** Raw form values (strings), before validation. */
export type ShipmentFormValues = { [K in keyof ShipmentInput]: string };

// ---------------------------------------------------------------------------
// Invoice: everything the PDF prints. Built from a saved shipment row only, so
// the document always matches the record (and carries its invoice number).
// ---------------------------------------------------------------------------

export type InvoiceParty = {
  name: string;
  address: string;
  country: string;
  eori: string | null;
  taxId: string | null;
};

export type InvoiceData = {
  invoiceNumber: string;
  issuedAt: string;
  exporter: InvoiceParty;
  consignee: InvoiceParty;
  destination: string;
  incoterm: Incoterm;
  incotermPlace: string;
  currency: string;
  originCountry: string;
  packageCount: number;
  grossWeightKg: number;
  netWeightKg: number;
  line: { description: string; hsCode: string; quantity: number; unitPrice: number };
  signatory: { name: string; title: string | null };
};

export const INVOICE_COLUMNS =
  "invoice_number, created_at, description, country, hs_code, quantity, unit_price, currency, incoterm, incoterm_place, country_of_origin, package_count, gross_weight_kg, net_weight_kg, importer_name, importer_address, importer_tax_id, exporter_name, exporter_address, exporter_country, exporter_eori, exporter_tax_id, signatory_name, signatory_title";

type InvoiceRow = {
  invoice_number: string | null;
  created_at: string;
  description: string;
  country: string;
  hs_code: string;
  quantity: number | null;
  unit_price: number | string | null;
  currency: string | null;
  incoterm: Incoterm | null;
  incoterm_place: string | null;
  country_of_origin: string | null;
  package_count: number | null;
  gross_weight_kg: number | string | null;
  net_weight_kg: number | string | null;
  importer_name: string | null;
  importer_address: string | null;
  importer_tax_id: string | null;
  exporter_name: string | null;
  exporter_address: string | null;
  exporter_country: string | null;
  exporter_eori: string | null;
  exporter_tax_id: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
};

/** Null for shipments created before invoices carried the full legal particulars. */
export function invoiceFromRow(row: InvoiceRow): InvoiceData | null {
  const {
    invoice_number,
    quantity,
    unit_price,
    currency,
    incoterm,
    incoterm_place,
    country_of_origin,
    package_count,
    gross_weight_kg,
    net_weight_kg,
    importer_name,
    importer_address,
    exporter_name,
    exporter_address,
    exporter_country,
    signatory_name,
  } = row;

  if (
    !invoice_number ||
    quantity == null ||
    unit_price == null ||
    !currency ||
    !incoterm ||
    !incoterm_place ||
    !country_of_origin ||
    package_count == null ||
    gross_weight_kg == null ||
    net_weight_kg == null ||
    !importer_name ||
    !importer_address ||
    !exporter_name ||
    !exporter_address ||
    !exporter_country ||
    !signatory_name
  ) {
    return null;
  }

  return {
    invoiceNumber: invoice_number,
    issuedAt: row.created_at,
    exporter: {
      name: exporter_name,
      address: exporter_address,
      country: exporter_country,
      eori: row.exporter_eori,
      taxId: row.exporter_tax_id,
    },
    consignee: {
      name: importer_name,
      address: importer_address,
      country: row.country,
      eori: null,
      taxId: row.importer_tax_id,
    },
    destination: row.country,
    incoterm,
    incotermPlace: incoterm_place,
    currency,
    originCountry: country_of_origin,
    packageCount: package_count,
    // PostgREST may return numeric columns as strings.
    grossWeightKg: Number(gross_weight_kg),
    netWeightKg: Number(net_weight_kg),
    line: {
      description: row.description,
      hsCode: row.hs_code,
      quantity,
      unitPrice: Number(unit_price),
    },
    signatory: { name: signatory_name, title: row.signatory_title },
  };
}
