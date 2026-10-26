import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { packageGroups, type ShipmentDocuments, type TransportData } from "@/services/customs/documents";
import {
  adrDescription,
  documentNumber,
  dutiesPayer,
  freightPayer,
  freightPaymentTerms,
  packageTypeName,
} from "@/services/customs/freight";
import { regionName } from "@/services/customs/invoice";

import { BORDER, Box, HAIRLINE, MUTED, Party, RULE, TINT, cubicMetres, formatDate, integer, kilograms, kit } from "./kit";

export type CmrData = ShipmentDocuments & { transport: TransportData };

// CMR Art. 5(1): three originals, signed by sender and carrier.
const COPIES = [
  { n: 1, label: "Copy for the sender" },
  { n: 2, label: "Copy for the consignee" },
  { n: 3, label: "Copy for the carrier" },
] as const;

// CMR Art. 6(1)(k). Omitting it makes the carrier liable for any resulting loss (Art. 7(3)).
const CONVENTION_STATEMENT =
  "This carriage is subject, notwithstanding any clause to the contrary, to the Convention on the Contract for the International Carriage of Goods by Road (CMR).";

const s = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "flex-end" },
  cmr: { fontWeight: 600, fontSize: 24, letterSpacing: 2, lineHeight: 1 },
  cmrTitle: { marginLeft: 8, marginBottom: 2 },
  copyBadge: { borderWidth: BORDER, borderColor: RULE, paddingVertical: 3, paddingHorizontal: 6, marginBottom: 4 },
  copyNumber: { fontWeight: 600, fontSize: 9, textAlign: "right" },

  frame: { marginTop: 8, borderWidth: BORDER, borderColor: RULE },
  half: { width: "50%" },
  third: { width: "33.333%" },
  minParty: { minHeight: 64 },
  minSmall: { minHeight: 34 },

  goodsHead: { flexDirection: "row", backgroundColor: TINT, borderBottomWidth: BORDER, borderBottomColor: RULE },
  cMarks: { width: 92 },
  cCount: { width: 42, textAlign: "right" },
  cPacking: { width: 62 },
  cNature: { flex: 1 },
  cStat: { width: 50 },
  cGross: { width: 58, textAlign: "right" },
  cVolume: { width: 46, textAlign: "right" },
  adrRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: HAIRLINE, paddingVertical: 4, paddingHorizontal: 4 },
  adrTag: { fontWeight: 600, marginRight: 6 },
  totalRow: { flexDirection: "row", borderTopWidth: BORDER, borderTopColor: RULE },

  chargeTable: { marginTop: 3 },
  chargeRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  chargeHead: { color: MUTED, fontSize: 6 },
  chargeLabel: { flex: 1, paddingVertical: 1.5 },
  chargeCell: { width: 48, paddingVertical: 1.5, textAlign: "center" },

  signBox: { minHeight: 62 },
  statement: { marginTop: 6, fontSize: 7, color: MUTED, lineHeight: 1.4 },
});

// Boxes 6–12 fit about this many rows on one copy. A larger consolidated load
// is summarised and refers to the packing list, attached under box 5.
const MAX_GOODS_ROWS = 8;

/** "RF-01, RF-02" or, for long runs, "RF-01 … RF-24 (24)". */
function marksSummary(marks: string[]) {
  if (marks.length <= 4) return marks.join(", ");
  return `${marks[0]} … ${marks[marks.length - 1]} (${marks.length})`;
}

function Copy({ data, copy }: { data: CmrData; copy: (typeof COPIES)[number] }) {
  const { invoice, transport, packages, dangerousGoods } = data;
  const number = documentNumber(invoice.invoiceNumber, "CMR");
  const groups = packageGroups(packages);
  const totalGross = packages.reduce((sum, p) => sum + p.grossWeightKg, 0);
  const totalVolume = groups.reduce((sum, g) => sum + g.volumeM3, 0);
  const packingList = documentNumber(invoice.invoiceNumber, "PL");
  const goodsRows =
    groups.length <= MAX_GOODS_ROWS
      ? groups.map((group) => {
          const line = invoice.lines.find((l) => l.position === group.line);
          return {
            key: `${group.line}:${group.packageType}`,
            marks: marksSummary(group.marks),
            count: group.count,
            packing: packageTypeName(group.packageType, group.count),
            nature: line?.description ?? "",
            statistical: line?.hsCode ?? "",
            grossWeightKg: group.grossWeightKg,
            volumeM3: group.volumeM3,
          };
        })
      : [
          {
            key: "summary",
            marks: marksSummary(packages.map((p) => p.marks)),
            count: packages.length,
            packing: "Various",
            nature: `Consolidated load of ${invoice.lines.length} items, itemised in packing list ${packingList}`,
            statistical: "See PL",
            grossWeightKg: totalGross,
            volumeM3: totalVolume,
          },
        ];
  const freight = freightPayer(invoice.incoterm);
  const duties = dutiesPayer(invoice.incoterm);
  const takenOver = formatDate(transport.takingOverDate);

  const charges: Array<[string, "sender" | "consignee" | null]> = [
    ["Carriage charges", freight],
    ["Supplementary charges", null],
    ["Customs duties", duties],
    ["Other charges", null],
  ];

  return (
    <Page size="A4" style={kit.page}>
      <View style={kit.header}>
        <View style={s.brand}>
          <Text style={s.cmr}>CMR</Text>
          <View style={s.cmrTitle}>
            <Text style={{ fontWeight: 600, fontSize: 9 }}>International consignment note</Text>
            <Text style={kit.subtitle}>Convention on the Contract for the International Carriage of Goods by Road</Text>
          </View>
        </View>
        <View>
          <View style={s.copyBadge}>
            <Text style={kit.docNumberLabel}>Original {copy.n} of 3</Text>
            <Text style={s.copyNumber}>{copy.label}</Text>
          </View>
          <Text style={kit.docNumberLabel}>Consignment note no.</Text>
          <Text style={kit.docNumber}>{number}</Text>
        </View>
      </View>

      <View style={s.frame}>
        <View style={[kit.row, kit.rowRule]}>
          <Box n={1} label="Sender (name, address, country)" style={[s.half, s.minParty, kit.colRule]}>
            <Party party={{ ...invoice.exporter, ids: [["EORI", invoice.exporter.eori], ["VAT", invoice.exporter.taxId]] }} />
          </Box>
          <Box n={16} label="Carrier (name, address, country)" style={[s.half, s.minParty]}>
            <Party party={transport.carrier} />
            <Text style={[kit.line, { marginTop: 3 }]}>
              <Text style={kit.muted}>Vehicle </Text>
              <Text style={kit.strong}>{transport.vehicleRegistration}</Text>
              {transport.trailerRegistration ? (
                <>
                  <Text style={kit.muted}>   Trailer </Text>
                  <Text style={kit.strong}>{transport.trailerRegistration}</Text>
                </>
              ) : null}
            </Text>
          </Box>
        </View>

        <View style={[kit.row, kit.rowRule]}>
          <Box n={2} label="Consignee (name, address, country)" style={[s.half, s.minParty, kit.colRule]}>
            <Party party={{ ...invoice.consignee, ids: [["VAT / Tax ID", invoice.consignee.taxId]] }} />
          </Box>
          <Box n={17} label="Successive carriers (name, address, country)" style={[s.half, s.minParty]} />
        </View>

        <View style={[kit.row, kit.rowRule]}>
          <Box n={3} label="Place designated for delivery of the goods (place, country)" style={[s.half, s.minSmall, kit.colRule]}>
            <Text style={kit.value}>{transport.deliveryPlace}</Text>
            <Text style={kit.line}>{regionName(invoice.destination)}</Text>
          </Box>
          <Box n={18} label="Carrier's reservations and observations" style={[s.half, s.minSmall]} />
        </View>

        <View style={[kit.row, kit.rowRule]}>
          <Box n={4} label="Place and date of taking over the goods (place, country, date)" style={[s.half, s.minSmall, kit.colRule]}>
            <Text style={kit.value}>{transport.takingOverPlace}</Text>
            <Text style={kit.line}>{takenOver}</Text>
          </Box>
          <Box n={5} label="Documents attached" style={[s.half, s.minSmall]}>
            <Text style={kit.line}>Commercial invoice {invoice.invoiceNumber}</Text>
            <Text style={kit.line}>Packing list {packingList}</Text>
          </Box>
        </View>

        {/* Boxes 6–12: one row per item and kind of package. */}
        <View style={kit.rowRule}>
          <View style={s.goodsHead}>
            <Text style={[kit.th, s.cMarks, kit.hairlineCol]}>6 Marks and numbers</Text>
            <Text style={[kit.th, s.cCount, kit.hairlineCol]}>7 No. of packages</Text>
            <Text style={[kit.th, s.cPacking, kit.hairlineCol]}>8 Method of packing</Text>
            <Text style={[kit.th, s.cNature, kit.hairlineCol]}>9 Nature of the goods</Text>
            <Text style={[kit.th, s.cStat, kit.hairlineCol]}>10 Statistical no.</Text>
            <Text style={[kit.th, s.cGross, kit.hairlineCol]}>11 Gross weight kg</Text>
            <Text style={[kit.th, s.cVolume]}>12 Volume m³</Text>
          </View>
          {goodsRows.map((row, i) => (
            <View key={row.key} style={[kit.row, i > 0 ? { borderTopWidth: 0.5, borderTopColor: HAIRLINE } : {}]} wrap={false}>
              <Text style={[kit.td, s.cMarks, kit.hairlineCol]}>{row.marks}</Text>
              <Text style={[kit.td, s.cCount, kit.hairlineCol, kit.strong]}>{integer.format(row.count)}</Text>
              <Text style={[kit.td, s.cPacking, kit.hairlineCol]}>{row.packing}</Text>
              <Text style={[kit.td, s.cNature, kit.hairlineCol]}>{row.nature}</Text>
              <Text style={[kit.td, s.cStat, kit.hairlineCol]}>{row.statistical}</Text>
              <Text style={[kit.td, s.cGross, kit.hairlineCol]}>{kilograms.format(row.grossWeightKg)}</Text>
              <Text style={[kit.td, s.cVolume]}>{cubicMetres.format(row.volumeM3)}</Text>
            </View>
          ))}
          {dangerousGoods ? (
            <View style={s.adrRow} wrap={false}>
              <Text style={s.adrTag}>ADR</Text>
              <Text style={kit.strong}>{adrDescription(dangerousGoods)}</Text>
            </View>
          ) : null}
          <View style={s.totalRow} wrap={false}>
            <Text style={[kit.td, s.cMarks, kit.hairlineCol, kit.strong]}>Total</Text>
            <Text style={[kit.td, s.cCount, kit.hairlineCol, kit.strong]}>{integer.format(packages.length)}</Text>
            <Text style={[kit.td, s.cPacking, kit.hairlineCol]} />
            <Text style={[kit.td, s.cNature, kit.hairlineCol]} />
            <Text style={[kit.td, s.cStat, kit.hairlineCol]} />
            <Text style={[kit.td, s.cGross, kit.hairlineCol, kit.strong]}>{kilograms.format(totalGross)}</Text>
            <Text style={[kit.td, s.cVolume, kit.strong]}>{cubicMetres.format(totalVolume)}</Text>
          </View>
        </View>

        <View style={[kit.row, kit.rowRule]}>
          <Box n={13} label="Sender's instructions (customs and other formalities)" style={[s.half, s.minSmall, kit.colRule]}>
            {transport.senderInstructions?.split("\n").map((line, i) => (
              <Text key={i} style={kit.line}>
                {line}
              </Text>
            ))}
          </Box>
          <Box n={19} label="Special agreements" style={[s.half, s.minSmall]} />
        </View>

        <View style={[kit.row, kit.rowRule]}>
          <View style={[s.half, kit.colRule]}>
            <Box n={14} label="Directions as to payment for carriage" style={[s.minSmall, kit.rowRule]}>
              <Text style={kit.value}>{freightPaymentTerms(invoice.incoterm)}</Text>
              <Text style={kit.note}>Incoterms® 2020 {invoice.incoterm} {invoice.incotermPlace}</Text>
            </Box>
            <Box n={15} label="Cash on delivery" style={s.minSmall} />
          </View>
          <Box n={20} label="To be paid by" style={s.half}>
            <View style={s.chargeTable}>
              <View style={s.chargeRow}>
                <Text style={[s.chargeLabel, s.chargeHead]} />
                <Text style={[s.chargeCell, s.chargeHead]}>Sender</Text>
                <Text style={[s.chargeCell, s.chargeHead]}>Currency</Text>
                <Text style={[s.chargeCell, s.chargeHead]}>Consignee</Text>
              </View>
              {charges.map(([label, payer]) => (
                <View key={label} style={s.chargeRow}>
                  <Text style={s.chargeLabel}>{label}</Text>
                  <Text style={[s.chargeCell, kit.strong]}>{payer === "sender" ? "X" : ""}</Text>
                  <Text style={s.chargeCell} />
                  <Text style={[s.chargeCell, kit.strong]}>{payer === "consignee" ? "X" : ""}</Text>
                </View>
              ))}
            </View>
          </Box>
        </View>

        <View style={[kit.row, kit.rowRule]}>
          <Box n={21} label="Established in" style={[{ width: "100%" }]}>
            <Text style={kit.value}>
              {transport.takingOverPlace}
              <Text style={kit.muted}>  on  </Text>
              {takenOver}
            </Text>
          </Box>
        </View>

        <View style={kit.row}>
          <Box n={22} label="Signature and stamp of the sender" style={[s.third, s.signBox, kit.colRule]}>
            <Text style={[kit.line, { marginTop: 3 }]}>{invoice.signatory.name}</Text>
          </Box>
          <Box n={23} label="Signature and stamp of the carrier" style={[s.third, s.signBox, kit.colRule]}>
            <Text style={[kit.line, { marginTop: 3 }]}>{transport.carrier.name}</Text>
          </Box>
          <Box n={24} label="Goods received: place, date, signature and stamp of the consignee" style={[s.third, s.signBox]} />
        </View>
      </View>

      <Text style={s.statement}>{CONVENTION_STATEMENT}</Text>

      <View style={kit.footer} fixed>
        <Text>
          {number} · Original {copy.n} of 3 · {copy.label}
        </Text>
        <Text>{invoice.exporter.name}</Text>
      </View>
    </Page>
  );
}

/** The CMR consignment note: three signed originals (CMR Art. 5), one page each. */
export function CMRDocument({ data }: { data: CmrData }) {
  const number = documentNumber(data.invoice.invoiceNumber, "CMR");
  return (
    <Document title={`CMR ${number}`} author={data.invoice.exporter.name} subject="CMR consignment note">
      {COPIES.map((copy) => (
        <Copy key={copy.n} data={data} copy={copy} />
      ))}
    </Document>
  );
}
