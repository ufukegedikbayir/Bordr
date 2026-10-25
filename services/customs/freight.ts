// Reference data and derived terms for the freight documents (CMR, packing
// list, certificate of origin). Shared by the form, the Server Action and the
// PDFs; no server-only imports. See docs/CUSTOMS_ARCHITECTURE.md.
import type { Incoterm } from "./invoice";

export const PACKAGE_TYPES = [
  { code: "eur_pallet", name: "EUR pallet", plural: "EUR pallets", dimensions: { lengthCm: 120, widthCm: 80 } },
  { code: "pallet", name: "Pallet", plural: "Pallets" },
  { code: "crate", name: "Crate", plural: "Crates" },
  { code: "carton", name: "Carton", plural: "Cartons" },
  { code: "drum", name: "Drum", plural: "Drums" },
  { code: "ibc", name: "IBC", plural: "IBCs" },
  { code: "bag", name: "Bag", plural: "Bags" },
  { code: "other", name: "Package", plural: "Packages" },
] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number]["code"];

export function packageTypeName(code: string, count = 1): string {
  const type = PACKAGE_TYPES.find((t) => t.code === code);
  if (!type) return code;
  return count === 1 ? type.name : type.plural;
}

/** ADR label model numbers (classes and divisions) accepted on the transport document. */
export const ADR_CLASSES = [
  { code: "1.1", name: "Explosives, mass explosion hazard" },
  { code: "1.2", name: "Explosives, projection hazard" },
  { code: "1.3", name: "Explosives, fire hazard" },
  { code: "1.4", name: "Explosives, minor hazard" },
  { code: "1.5", name: "Very insensitive explosives" },
  { code: "1.6", name: "Extremely insensitive articles" },
  { code: "2.1", name: "Flammable gases" },
  { code: "2.2", name: "Non-flammable, non-toxic gases" },
  { code: "2.3", name: "Toxic gases" },
  { code: "3", name: "Flammable liquids" },
  { code: "4.1", name: "Flammable solids" },
  { code: "4.2", name: "Spontaneously combustible substances" },
  { code: "4.3", name: "Dangerous when wet" },
  { code: "5.1", name: "Oxidising substances" },
  { code: "5.2", name: "Organic peroxides" },
  { code: "6.1", name: "Toxic substances" },
  { code: "6.2", name: "Infectious substances" },
  { code: "7", name: "Radioactive material" },
  { code: "8", name: "Corrosive substances" },
  { code: "9", name: "Miscellaneous dangerous goods" },
] as const;

export type AdrClass = (typeof ADR_CLASSES)[number]["code"];

export const PACKING_GROUPS = ["I", "II", "III"] as const;
export type PackingGroup = (typeof PACKING_GROUPS)[number];

/** ADR 1.9.5.3: tunnel restriction codes as printed on the transport document. */
export const TUNNEL_CODES = ["B", "B1000C", "B/D", "B/E", "C", "C5000D", "C/D", "C/E", "D", "D/E", "E"] as const;
export type TunnelCode = (typeof TUNNEL_CODES)[number];

/** One CMR per vehicle (CMR Art. 5(2)): the load a single truck can carry. */
export const MAX_PAYLOAD_KG = 30_000;
export const MAX_PAYLOAD_M3 = 120;
export const MAX_PACKAGES = 99;

/** Package bounds in cm: a standard semi-trailer (13.6 m × 2.48 m × 2.7 m). */
export const PACKAGE_LIMITS_CM = { lengthCm: 1400, widthCm: 260, heightCm: 300 } as const;

export type DangerousGoods = {
  unNumber: string;
  shippingName: string;
  hazardClass: AdrClass;
  packingGroup: PackingGroup | null;
  tunnelCode: TunnelCode | null;
};

/**
 * The ADR 5.4.1.1.1 description, in its mandated order:
 * "UN 1263 PAINT, 3, III, (D/E)".
 */
export function adrDescription(goods: DangerousGoods): string {
  return [
    `UN ${goods.unNumber} ${goods.shippingName}`,
    goods.hazardClass,
    goods.packingGroup,
    goods.tunnelCode ? `(${goods.tunnelCode})` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Terms derived from Incoterms® 2020
// ---------------------------------------------------------------------------

/** Who pays the main carriage: the buyer contracts it under EXW and FCA. */
export function freightPayer(incoterm: Incoterm): "sender" | "consignee" {
  return incoterm === "EXW" || incoterm === "FCA" ? "consignee" : "sender";
}

/** Who pays import duties and taxes: only DDP puts them on the seller. */
export function dutiesPayer(incoterm: Incoterm): "sender" | "consignee" {
  return incoterm === "DDP" ? "sender" : "consignee";
}

/** CMR box 14. */
export function freightPaymentTerms(incoterm: Incoterm): string {
  return freightPayer(incoterm) === "sender"
    ? `Carriage paid: freight paid by the sender (${incoterm})`
    : `Carriage forward: freight paid by the consignee (${incoterm})`;
}

/**
 * CMR box 13 default, per CMR Art. 6(1)(j): who clears customs. Under EXW the
 * buyer clears export too; under DDP the seller clears import too.
 */
export function customsFormalities(incoterm: Incoterm): string {
  if (incoterm === "EXW") return "Export and import customs clearance by the consignee (EXW).";
  if (incoterm === "DDP") return "Export and import customs clearance by the sender, duties paid (DDP).";
  return `Export customs clearance by the sender. Import customs clearance by the consignee (${incoterm}).`;
}

/** Each document's number shares the shipment's sequence: INV-2026-00042 -> CMR-2026-00042. */
export function documentNumber(invoiceNumber: string, prefix: "PL" | "CMR" | "COO"): string {
  return invoiceNumber.replace(/^INV-/, `${prefix}-`);
}
