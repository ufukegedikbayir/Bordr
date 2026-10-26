// Everything the four freight documents print, built from one saved shipment
// row so they always agree with the record and with each other.
import {
  ADR_CLASSES,
  PACKING_GROUPS,
  TUNNEL_CODES,
  type DangerousGoods,
  type PackageType,
} from "./freight";
import { INVOICE_COLUMNS, invoiceFromRow, type InvoiceData, type InvoiceRow } from "./invoice";

export type PackageData = {
  position: number;
  packageType: PackageType;
  marks: string;
  quantity: number;
  netWeightKg: number;
  grossWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type TransportData = {
  carrier: { name: string; address: string; country: string };
  vehicleRegistration: string;
  trailerRegistration: string | null;
  takingOverPlace: string;
  /** YYYY-MM-DD */
  takingOverDate: string;
  deliveryPlace: string;
  senderInstructions: string | null;
};

export type ShipmentDocuments = {
  invoice: InvoiceData;
  /** Empty for shipments created before packages were recorded. */
  packages: PackageData[];
  /** Null for shipments created before transport details were recorded. */
  transport: TransportData | null;
  dangerousGoods: DangerousGoods | null;
};

export type DocumentKind = "invoice" | "packing-list" | "cmr" | "certificate-of-origin";

export const DOCUMENT_KINDS: ReadonlyArray<{ kind: DocumentKind; name: string; short: string }> = [
  { kind: "invoice", name: "Commercial invoice", short: "Invoice" },
  { kind: "packing-list", name: "Packing list", short: "Packing list" },
  { kind: "cmr", name: "CMR consignment note", short: "CMR" },
  { kind: "certificate-of-origin", name: "Certificate of origin application", short: "Origin" },
];

/** Which documents a saved shipment has the particulars for. */
export function availableDocuments(docs: ShipmentDocuments): DocumentKind[] {
  const kinds: DocumentKind[] = ["invoice"];
  if (docs.packages.length) kinds.push("packing-list", "certificate-of-origin");
  if (docs.packages.length && docs.transport) kinds.push("cmr");
  return DOCUMENT_KINDS.map(({ kind }) => kind).filter((kind) => kinds.includes(kind));
}

export const PACKAGE_COLUMNS =
  "position, package_type, marks, quantity, net_weight_kg, gross_weight_kg, length_cm, width_cm, height_cm";

export const DOCUMENT_COLUMNS = `${INVOICE_COLUMNS}, carrier_name, carrier_address, carrier_country, vehicle_registration, trailer_registration, taking_over_place, taking_over_date, delivery_place, sender_instructions, adr_un_number, adr_shipping_name, adr_class, adr_packing_group, adr_tunnel_code, shipment_packages (${PACKAGE_COLUMNS})`;

type PackageRow = {
  position: number;
  package_type: PackageType;
  marks: string;
  quantity: number;
  net_weight_kg: number | string;
  gross_weight_kg: number | string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type DocumentRow = InvoiceRow & {
  carrier_name: string | null;
  carrier_address: string | null;
  carrier_country: string | null;
  vehicle_registration: string | null;
  trailer_registration: string | null;
  taking_over_place: string | null;
  taking_over_date: string | null;
  delivery_place: string | null;
  sender_instructions: string | null;
  adr_un_number: string | null;
  adr_shipping_name: string | null;
  adr_class: string | null;
  adr_packing_group: string | null;
  adr_tunnel_code: string | null;
  shipment_packages: PackageRow[] | null;
};

function transportFromRow(row: DocumentRow): TransportData | null {
  const { carrier_name, carrier_address, carrier_country, vehicle_registration, taking_over_place, taking_over_date, delivery_place } = row;
  if (!carrier_name || !carrier_address || !carrier_country || !vehicle_registration || !taking_over_place || !taking_over_date || !delivery_place) {
    return null;
  }
  return {
    carrier: { name: carrier_name, address: carrier_address, country: carrier_country },
    vehicleRegistration: vehicle_registration,
    trailerRegistration: row.trailer_registration,
    takingOverPlace: taking_over_place,
    takingOverDate: taking_over_date,
    deliveryPlace: delivery_place,
    senderInstructions: row.sender_instructions,
  };
}

function dangerousGoodsFromRow(row: DocumentRow): DangerousGoods | null {
  const { adr_un_number, adr_shipping_name, adr_class } = row;
  if (!adr_un_number || !adr_shipping_name || !ADR_CLASSES.some(({ code }) => code === adr_class)) return null;
  return {
    unNumber: adr_un_number,
    shippingName: adr_shipping_name,
    hazardClass: adr_class as DangerousGoods["hazardClass"],
    packingGroup: (PACKING_GROUPS as readonly string[]).includes(row.adr_packing_group ?? "")
      ? (row.adr_packing_group as DangerousGoods["packingGroup"])
      : null,
    tunnelCode: (TUNNEL_CODES as readonly string[]).includes(row.adr_tunnel_code ?? "")
      ? (row.adr_tunnel_code as DangerousGoods["tunnelCode"])
      : null,
  };
}

/** Null when the shipment lacks invoice particulars (created before Phase 6.5). */
export function documentsFromRow(row: DocumentRow): ShipmentDocuments | null {
  const invoice = invoiceFromRow(row);
  if (!invoice) return null;

  const packages = (row.shipment_packages ?? [])
    .map(
      (p): PackageData => ({
        position: p.position,
        packageType: p.package_type,
        marks: p.marks,
        quantity: p.quantity,
        // PostgREST may return numeric columns as strings.
        netWeightKg: Number(p.net_weight_kg),
        grossWeightKg: Number(p.gross_weight_kg),
        lengthCm: p.length_cm,
        widthCm: p.width_cm,
        heightCm: p.height_cm,
      }),
    )
    .sort((a, b) => a.position - b.position);

  return { invoice, packages, transport: transportFromRow(row), dangerousGoods: dangerousGoodsFromRow(row) };
}

export function packageVolumeM3(p: Pick<PackageData, "lengthCm" | "widthCm" | "heightCm">): number {
  return (p.lengthCm * p.widthCm * p.heightCm) / 1_000_000;
}

/** Packages grouped by type, in first-appearance order (CMR boxes 6–12). */
export function packageGroups(packages: PackageData[]) {
  const groups = new Map<PackageType, PackageData[]>();
  for (const p of packages) groups.set(p.packageType, [...(groups.get(p.packageType) ?? []), p]);
  return [...groups.entries()].map(([packageType, items]) => ({
    packageType,
    packages: items,
    marks: items.map((p) => p.marks),
    count: items.length,
    grossWeightKg: items.reduce((sum, p) => sum + p.grossWeightKg, 0),
    volumeM3: items.reduce((sum, p) => sum + packageVolumeM3(p), 0),
  }));
}
