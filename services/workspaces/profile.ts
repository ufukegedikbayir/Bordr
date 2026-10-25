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

// ---------------------------------------------------------------------------
// Validation. One source of truth: the settings form runs these as the user
// types, and updateWorkspaceProfile runs them again on the server.
// ---------------------------------------------------------------------------

/**
 * Typing masks, applied on every keystroke. They only make changes the user
 * can't object to (case, stray spaces); anything else is reported, never
 * silently deleted.
 */
export const PROFILE_MASKS: Partial<Record<keyof CompanyProfile, (value: string) => string>> = {
  // EORI numbers never contain spaces.
  eoriNumber: (v) => v.replace(/\s/g, "").toUpperCase(),
  taxId: (v) => tidy(v).toUpperCase(),
  postalCode: (v) => tidy(v).toUpperCase(),
};

/** No leading whitespace, no runs of spaces. Trailing space survives so the user can keep typing. */
export function tidy(value: string): string {
  return value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
}

const collapse = (v: string) => v.trim().replace(/\s+/g, " ");

// Letters in any script (\p{L}, with accents \p{M}), digits, and the
// punctuation real names and addresses use. Emoji and symbols are excluded.
const COMPANY_NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’&()/+-]*$/u;
const ADDRESS = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()/#°º-]*$/u;
const CITY = /^\p{L}[\p{L}\p{M}\p{N} .,'’()-]*$/u;
const PERSON = /^\p{L}[\p{L}\p{M} .,'’-]*$/u;
// 2–10 letters or digits, single spaces or dashes between them: 10115, SW1A 1AA, 1010-001.
const POSTAL_CODE = /^[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/;
// Stricter than the database's TAX_ID_PATTERN: separators only between characters, never doubled.
const STRICT_TAX_ID = /^[A-Z0-9]+(?:[ ./-][A-Z0-9]+)*$/;

const SYMBOLS = "Use letters, numbers and normal punctuation only, no emoji or symbols.";

type Rule = { pattern: RegExp; message: string };

/** Trims and collapses spaces, then checks length and characters. */
const text = (what: string, max: number, rule: Rule, min = 1) =>
  z
    .string()
    .transform(collapse)
    .pipe(
      z
        .string()
        .min(1, `Enter ${what}.`)
        .min(min, `That ${what} is too short.`)
        .regex(rule.pattern, rule.message)
        .max(max, `Use at most ${max} characters.`),
    );

/** Blank becomes null, so optional columns are cleared rather than set to "". */
const optional = (max: number, rule: Rule, normalize: (v: string) => string = collapse) =>
  z
    .string()
    .transform(normalize)
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(rule.pattern, rule.message).max(max, `Use at most ${max} characters.`),
      ]),
    )
    .transform((v) => v || null);

const profileFields = z.object({
  legalName: text("the registered company name", 200, { pattern: COMPANY_NAME, message: SYMBOLS }),
  addressLine1: text("the street address", 200, { pattern: ADDRESS, message: SYMBOLS }),
  addressLine2: optional(200, { pattern: ADDRESS, message: SYMBOLS }),
  postalCode: z
    .string()
    .transform((v) => collapse(v).toUpperCase())
    .pipe(
      z
        .string()
        .min(1, "Enter the postal code.")
        .min(2, "That postal code is too short.")
        .max(10, "Postal codes are at most 10 characters.")
        .regex(POSTAL_CODE, "Use letters and digits, with single spaces or dashes between them."),
    ),
  city: text("the city", 100, { pattern: CITY, message: "Use letters and normal punctuation only, no emoji or symbols." }),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/, "Choose a country.")
    .refine((v) => isIsoCountry(v) && v !== "EU", "Choose a country."),
  eoriNumber: optional(
    17,
    { pattern: EORI_PATTERN, message: "Must start with a 2-letter country code followed by up to 15 characters." },
    (v) => v.replace(/\s/g, "").toUpperCase(),
  ),
  taxId: optional(
    30,
    // TAX_ID_PATTERN is what the database enforces; STRICT_TAX_ID also rejects doubled or trailing separators.
    {
      pattern: new RegExp(`(?=${TAX_ID_PATTERN.source})${STRICT_TAX_ID.source}`),
      message: "Use letters and digits, with single spaces, dots, slashes or dashes between them.",
    },
    (v) => collapse(v).toUpperCase(),
  ),
  signatoryName: text(
    "the signatory's name",
    120,
    { pattern: PERSON, message: "Use letters only, with spaces, dots, hyphens or apostrophes." },
    2,
  ),
  signatoryTitle: optional(120, { pattern: COMPANY_NAME, message: SYMBOLS }),
});

const NO_IDENTITY = "Enter an EORI number, a VAT / tax ID, or both.";

export const companyProfileSchema = profileFields.refine((v) => v.eoriNumber || v.taxId, {
  path: ["eoriNumber"],
  message: NO_IDENTITY,
});

export type CompanyProfileInput = z.output<typeof companyProfileSchema>;

export type ProfileFormValues = { [K in keyof CompanyProfile]: string };
export type ProfileFieldErrors = Partial<Record<keyof CompanyProfile, string>>;

export const PROFILE_FIELDS = Object.keys(profileFields.shape) as Array<keyof CompanyProfile>;

/**
 * First error per field, checking every field independently. (The object
 * schema skips its EORI-or-VAT rule while any field is invalid; the form
 * needs all errors at once.)
 */
export function validateProfile(values: ProfileFormValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  for (const key of PROFILE_FIELDS) {
    const result = profileFields.shape[key].safeParse(values[key]);
    if (!result.success) errors[key] = result.error.issues[0]?.message;
  }
  if (!errors.eoriNumber && !errors.taxId && !values.eoriNumber.trim() && !values.taxId.trim()) {
    errors.eoriNumber = NO_IDENTITY;
  }
  return errors;
}

export function profileToValues(profile: CompanyProfile): ProfileFormValues {
  return Object.fromEntries(PROFILE_FIELDS.map((key) => [key, profile[key] ?? ""])) as ProfileFormValues;
}
