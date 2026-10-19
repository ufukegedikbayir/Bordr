// Shared by the customs Server Action and the UI. Kept out of actions.ts
// because a "use server" module may only export async functions.

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "CA", name: "Canada" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export function countryName(code: CountryCode): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

export const MAX_DESCRIPTION_LENGTH = 500;

export const EXAMPLE_PRODUCTS = [
  "Handmade leather wallet, 250g",
  "Cotton t-shirt, 180g",
  "Ceramic coffee mug, 350g",
] as const;

export type CustomsResult = {
  /** Harmonized System code, e.g. "4202.31" */
  hsCode: string;
  /** Short name of the HS category, at most 6 words */
  hsDescription: string;
  /** Ad valorem import duty as a display string, e.g. "5.0%" */
  estimatedDuty: string;
  /** Documents required to clear customs */
  requiredDocuments: string[];
  /** Destination the estimate was generated for */
  country: CountryCode;
};

export type CustomsActionResult =
  | { ok: true; data: CustomsResult; saved: boolean }
  | { ok: false; error: string };
