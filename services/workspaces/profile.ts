// The workspace's company profile: the exporter's legal identity printed on
// every invoice. Shared by the settings form, its Server Action and queries.
import { z } from "zod";

import { EORI_PATTERN, TAX_ID_PATTERN, isIsoCountry } from "@/services/customs/invoice";

export type CompanyProfile = {
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  eoriNumber: string | null;
  taxId: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
};

export const PROFILE_COLUMNS =
  "legal_name, address_line1, address_line2, postal_code, city, country_code, eori_number, tax_id, signatory_name, signatory_title";

export type ProfileRow = {
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  eori_number: string | null;
  tax_id: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
};

export function profileFromRow(row: ProfileRow): CompanyProfile {
  return {
    legalName: row.legal_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    countryCode: row.country_code,
    eoriNumber: row.eori_number,
    taxId: row.tax_id,
    signatoryName: row.signatory_name,
    signatoryTitle: row.signatory_title,
  };
}

/**
 * What the database's shipment trigger requires, as labels for the UI.
 * Keep in step with `private.stamp_shipment_invoice`.
 */
export const PROFILE_REQUIREMENTS: ReadonlyArray<{ label: string; met: (p: CompanyProfile) => boolean }> = [
  { label: "Registered company name", met: (p) => Boolean(p.legalName) },
  { label: "Registered address", met: (p) => Boolean(p.addressLine1 && p.postalCode && p.city && p.countryCode) },
  { label: "EORI number or VAT / Tax ID", met: (p) => Boolean(p.eoriNumber || p.taxId) },
  { label: "Authorised signatory", met: (p) => Boolean(p.signatoryName) },
];

export function isProfileComplete(profile: CompanyProfile): boolean {
  return PROFILE_REQUIREMENTS.every(({ met }) => met(profile));
}

const required = (what: string, max: number) =>
  z.string().trim().min(1, `Enter ${what}.`).max(max, `Keep ${what} under ${max} characters.`);

/** Blank becomes null, so optional columns are cleared rather than set to "". */
const optional = (max: number, pattern?: RegExp, message?: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .refine((v) => !pattern || v === "" || pattern.test(v), message)
    .transform((v) => v || null);

export const companyProfileSchema = z
  .object({
    legalName: required("the registered company name", 200),
    addressLine1: required("the street address", 200),
    addressLine2: optional(200),
    postalCode: required("the postal code", 20),
    city: required("the city", 100),
    countryCode: z.string().refine((v) => isIsoCountry(v) && v !== "EU", "Choose a country."),
    // EORI numbers are written without spaces.
    eoriNumber: z
      .string()
      .transform((v) => v.replace(/\s/g, "").toUpperCase())
      .pipe(optional(17, EORI_PATTERN, "Use the country code then up to 15 letters or digits, e.g. DE123456789012345.")),
    taxId: z
      .string()
      .transform((v) => v.trim().toUpperCase())
      .pipe(optional(30, TAX_ID_PATTERN, "Use letters, digits, spaces, dots, slashes or dashes.")),
    signatoryName: required("the signatory's name", 120),
    signatoryTitle: optional(120),
  })
  .refine((v) => v.eoriNumber || v.taxId, {
    path: ["eoriNumber"],
    message: "Enter an EORI number, a VAT / tax ID, or both.",
  });

export type CompanyProfileInput = z.output<typeof companyProfileSchema>;
