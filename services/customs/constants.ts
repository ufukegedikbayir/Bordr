// Shared by the customs Server Action and the UI. Kept out of actions.ts
// because a "use server" module may only export async functions.

import { COUNTRY_NAMES } from "./countries";
import type { ShipmentDocuments } from "./documents";

/** EU member states: one customs territory, so no customs border between them. */
export const EU_MEMBER_STATES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

// Where Bordr ships to by road: the EU, the rest of geographic Europe and the
// Caucasus on the TIR routes, Türkiye, plus the US and Canada from before.
// Russia and Belarus are left out: EU sanctions bar most road freight to
// them, and Bordr doesn't screen goods against sanctions lists.
const DESTINATION_CODES = [
  ...EU_MEMBER_STATES,
  "AL", "AD", "AM", "AZ", "BA", "CH", "GB", "GE", "IS", "LI", "MC", "MD", "ME", "MK",
  "NO", "RS", "SM", "TR", "UA", "VA", "XK",
  "US", "CA",
] as const;

export type CountryCode = (typeof DESTINATION_CODES)[number];

const destinationSet: ReadonlySet<string> = new Set(DESTINATION_CODES);

/** Destination countries, alphabetical by English name (the order of COUNTRY_NAMES). */
export const DESTINATIONS = Object.entries(COUNTRY_NAMES)
  .filter(([code]) => destinationSet.has(code))
  .map(([code, name]) => ({ code: code as CountryCode, name }));

export function isCountryCode(code: string): code is CountryCode {
  return destinationSet.has(code);
}

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

/** Both ends inside the EU customs territory (Monaco included, via France). */
export function isIntraEu(from: string | null, to: string): boolean {
  const inside = (code: string | null) => code === "MC" || EU_MEMBER_STATES.some((c) => c === code);
  return inside(from) && inside(to);
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
  /** Short compliance flags from the AI, e.g. a missing certificate. May be empty. */
  complianceNotes: string[];
};

export type CustomsActionResult =
  /** `documents` is null when the shipment couldn't be saved: documents need its saved number. */
  | { ok: true; data: CustomsResult; documents: ShipmentDocuments | null }
  | {
      ok: false;
      error: string;
      reason?: "invalid" | "profile_incomplete";
      fieldErrors?: Partial<Record<string, string[]>>;
    };
