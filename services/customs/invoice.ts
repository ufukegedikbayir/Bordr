// Reference data and the commercial invoice data model, shared by the Server
// Actions, the form and the PDFs. No server-only imports: this ships to the
// browser too. The shipment input schema lives in shipment-input.ts.
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
// Identifier formats, as the database enforces them
// ---------------------------------------------------------------------------

export const TAX_ID_PATTERN = /^[A-Z0-9][A-Z0-9 ./-]{1,29}$/;
export const EORI_PATTERN = /^[A-Z]{2}[A-Z0-9]{1,15}$/;

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

export type InvoiceLine = {
  /** Item number, the same on every document. */
  position: number;
  description: string;
  hsCode: string;
  originCountry: string;
  quantity: number;
  unitPrice: number;
  netWeightKg: number;
  grossWeightKg: number;
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
  packageCount: number;
  grossWeightKg: number;
  netWeightKg: number;
  /** At least one, ordered by position. */
  lines: InvoiceLine[];
  signatory: { name: string; title: string | null };
};

export const LINE_COLUMNS =
  "position, description, hs_code, hs_description, estimated_duty, quantity, unit_price, origin_country, net_weight_kg, gross_weight_kg";

export const INVOICE_COLUMNS = `invoice_number, created_at, country, currency, incoterm, incoterm_place, package_count, gross_weight_kg, net_weight_kg, importer_name, importer_address, importer_tax_id, exporter_name, exporter_address, exporter_country, exporter_eori, exporter_tax_id, signatory_name, signatory_title, shipment_lines (${LINE_COLUMNS})`;

export type LineRow = {
  position: number;
  description: string;
  hs_code: string;
  hs_description: string;
  estimated_duty: string;
  quantity: number | null;
  unit_price: number | string | null;
  origin_country: string | null;
  net_weight_kg: number | string | null;
  gross_weight_kg: number | string | null;
};

export type InvoiceRow = {
  invoice_number: string | null;
  created_at: string;
  country: string;
  currency: string | null;
  incoterm: Incoterm | null;
  incoterm_place: string | null;
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
  shipment_lines: LineRow[] | null;
};

/** Null if the line lacks invoice facts (shipments from before invoices). */
function lineFromRow(row: LineRow): InvoiceLine | null {
  const { quantity, unit_price, origin_country, net_weight_kg, gross_weight_kg } = row;
  if (quantity == null || unit_price == null || !origin_country || net_weight_kg == null || gross_weight_kg == null) return null;
  return {
    position: row.position,
    description: row.description,
    hsCode: row.hs_code,
    originCountry: origin_country,
    quantity,
    // PostgREST may return numeric columns as strings.
    unitPrice: Number(unit_price),
    netWeightKg: Number(net_weight_kg),
    grossWeightKg: Number(gross_weight_kg),
  };
}

/** Null for shipments created before invoices carried the full legal particulars. */
export function invoiceFromRow(row: InvoiceRow): InvoiceData | null {
  const {
    invoice_number,
    currency,
    incoterm,
    incoterm_place,
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

  const lines = [...(row.shipment_lines ?? [])].sort((a, b) => a.position - b.position).map(lineFromRow);

  if (
    !invoice_number ||
    !currency ||
    !incoterm ||
    !incoterm_place ||
    package_count == null ||
    gross_weight_kg == null ||
    net_weight_kg == null ||
    !importer_name ||
    !importer_address ||
    !exporter_name ||
    !exporter_address ||
    !exporter_country ||
    !signatory_name ||
    lines.length === 0 ||
    lines.some((line) => line === null)
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
    packageCount: package_count,
    grossWeightKg: Number(gross_weight_kg),
    netWeightKg: Number(net_weight_kg),
    lines: lines as InvoiceLine[],
    signatory: { name: signatory_name, title: row.signatory_title },
  };
}

/** Distinct origin countries, in line order. */
export function originCountries(invoice: Pick<InvoiceData, "lines">): string[] {
  return [...new Set(invoice.lines.map((line) => line.originCountry))];
}

export function lineValue(line: Pick<InvoiceLine, "quantity" | "unitPrice">): number {
  return Math.round(line.quantity * line.unitPrice * 100) / 100;
}

export function invoiceTotal(invoice: Pick<InvoiceData, "lines">): number {
  return Math.round(invoice.lines.reduce((sum, line) => sum + lineValue(line), 0) * 100) / 100;
}
