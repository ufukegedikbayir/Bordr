// A deliberately demanding shipment for rendering and checking the document
// suite: dangerous goods (ADR class 3), mixed package types, 14 packages,
// Turkish and German characters, a trailer, and a DAP named place.
import type { PackageData, ShipmentDocuments } from "@/services/customs/documents";

const EUR_PALLETS: PackageData[] = Array.from({ length: 12 }, (_, i) => ({
  position: i + 1,
  packageType: "eur_pallet",
  marks: `ABS/RF/2610/${String(i + 1).padStart(2, "0")}`,
  // 32 drums × 22.0 kg paint; drums 1.6 kg each, pallet 25 kg.
  quantity: 32,
  netWeightKg: 704,
  grossWeightKg: 780.2,
  lengthCm: 120,
  widthCm: 80,
  heightCm: 115,
}));

const HALF_LOADS: PackageData[] = [13, 14].map((position) => ({
  position,
  packageType: "pallet",
  marks: `ABS/RF/2610/${position}`,
  quantity: 16,
  netWeightKg: 352,
  grossWeightKg: 402.6,
  lengthCm: 120,
  widthCm: 100,
  heightCm: 62,
}));

const packages = [...EUR_PALLETS, ...HALF_LOADS];

export const complexShipment: ShipmentDocuments = {
  invoice: {
    invoiceNumber: "INV-2026-00042",
    issuedAt: "2026-10-27T09:14:00.000Z",
    exporter: {
      name: "Anadolu Boya Sanayi ve Ticaret A.Ş.",
      address: "Gebze Organize Sanayi Bölgesi, 1600. Sokak No 12\n41400 Gebze / Kocaeli",
      country: "TR",
      eori: "TR8140512349000",
      taxId: "8140512349",
    },
    consignee: {
      name: "Rhein-Ruhr Farbenhandel GmbH & Co. KG",
      address: "Hafenstraße 9–11, Logistikzentrum Nord\n47119 Duisburg",
      country: "DE",
      eori: null,
      taxId: "DE811234567",
    },
    destination: "DE",
    incoterm: "DAP",
    incotermPlace: "Duisburg, Logistikzentrum Nord",
    currency: "EUR",
    originCountry: "TR",
    packageCount: packages.length,
    grossWeightKg: packages.reduce((sum, p) => sum + p.grossWeightKg, 0),
    netWeightKg: packages.reduce((sum, p) => sum + p.netWeightKg, 0),
    line: {
      description: "Industrial alkyd paint, solvent-based, RAL 7035, in 20 l steel drums",
      hsCode: "3208.90",
      quantity: packages.reduce((sum, p) => sum + p.quantity, 0),
      unitPrice: 48.5,
    },
    signatory: { name: "Elif Yılmaz", title: "İhracat Müdürü (Export Manager)" },
  },
  packages,
  transport: {
    carrier: {
      name: "Marmara Uluslararası Lojistik A.Ş.",
      address: "Tuzla Liman Yolu No 3\n34940 Tuzla / İstanbul",
      country: "TR",
    },
    vehicleRegistration: "34 ABC 123",
    trailerRegistration: "34 TR 4567",
    takingOverPlace: "Gebze, Türkiye",
    takingOverDate: "2026-10-28",
    deliveryPlace: "Duisburg, Hafenstraße 9–11",
    senderInstructions:
      "Export customs clearance by the sender. Import customs clearance by the consignee (DAP).\nT1 transit from Kapıkule. Keep upright, do not stack more than 2 high.",
  },
  dangerousGoods: {
    unNumber: "1263",
    shippingName: "PAINT",
    hazardClass: "3",
    packingGroup: "III",
    tunnelCode: "D/E",
  },
};
