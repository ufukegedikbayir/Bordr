import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { packageVolumeM3, type ShipmentDocuments } from "@/services/customs/documents";
import { adrDescription, documentNumber, packageTypeName } from "@/services/customs/freight";
import { originCountries, regionName } from "@/services/customs/invoice";

import {
  BORDER,
  Box,
  DocumentHeader,
  Footer,
  HAIRLINE,
  Party,
  RULE,
  TINT,
  country,
  cubicMetres,
  formatDate,
  integer,
  kilograms,
  kit,
} from "./kit";

const s = StyleSheet.create({
  logo: { maxWidth: 140, maxHeight: 36, objectFit: "contain", marginBottom: 6, alignSelf: "flex-end" },
  frame: { marginTop: 10, borderWidth: BORDER, borderColor: RULE },
  left: { width: "54%" },
  right: { width: "46%" },
  minParty: { minHeight: 70 },
  cell: { flex: 1 },

  table: { marginTop: 10, borderWidth: BORDER, borderColor: RULE },
  cNo: { width: 20, textAlign: "center" },
  cMarks: { width: 78 },
  cType: { width: 46 },
  cGoods: { flex: 1 },
  goodsText: { fontSize: 7, lineHeight: 1.25 },
  cHs: { width: 42 },
  cQty: { width: 34, textAlign: "right" },
  cNet: { width: 48, textAlign: "right" },
  cGross: { width: 50, textAlign: "right" },
  cDims: { width: 58, textAlign: "center" },
  cVol: { width: 34, textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: BORDER, borderTopColor: RULE, backgroundColor: TINT },
  adr: { marginTop: 6, padding: 6, borderWidth: BORDER, borderColor: RULE, flexDirection: "row" },
  adrTag: { fontWeight: 600, marginRight: 6 },

  summary: { marginTop: 10, flexDirection: "row", borderWidth: BORDER, borderColor: RULE },
  summaryCell: { flex: 1, padding: 6 },
  summaryValue: { marginTop: 2, fontWeight: 600, fontSize: 10 },

  sign: { marginTop: 10, flexDirection: "row", borderWidth: BORDER, borderColor: RULE },
  signCell: { flex: 1, padding: 6, minHeight: 50 },
});

/** One row per package, with each package's contents, HS code, weights and dimensions. */
export function PackingList({ data, logoUrl }: { data: ShipmentDocuments; logoUrl?: string | null }) {
  const { invoice, packages, transport, dangerousGoods } = data;
  const number = documentNumber(invoice.invoiceNumber, "PL");
  const issued = formatDate(invoice.issuedAt);
  const origins = originCountries(invoice);
  const lineOf = (position: number) => invoice.lines.find((line) => line.position === position);
  const totals = {
    quantity: packages.reduce((sum, p) => sum + p.quantity, 0),
    net: packages.reduce((sum, p) => sum + p.netWeightKg, 0),
    gross: packages.reduce((sum, p) => sum + p.grossWeightKg, 0),
    volume: packages.reduce((sum, p) => sum + packageVolumeM3(p), 0),
  };

  return (
    <Document title={`Packing list ${number}`} author={invoice.exporter.name} subject="Packing list">
      <Page size="A4" style={kit.page}>
        <DocumentHeader
          title="PACKING LIST"
          subtitle="International road freight"
          numberLabel="Packing list no."
          number={number}
          aside={
            logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={logoUrl} style={s.logo} />
            ) : null
          }
        />

        <View style={[s.frame, kit.row]}>
          <View style={[s.left, kit.colRule]}>
            <Box n={1} label="Exporter / Shipper" style={[s.minParty, kit.rowRule]}>
              <Party party={{ ...invoice.exporter, ids: [["EORI", invoice.exporter.eori], ["VAT", invoice.exporter.taxId]] }} />
            </Box>
            <Box n={2} label="Consignee" style={s.minParty}>
              <Party party={{ ...invoice.consignee, ids: [["VAT / Tax ID", invoice.consignee.taxId]] }} />
            </Box>
          </View>
          <View style={s.right}>
            <View style={[kit.row, kit.rowRule]}>
              <Box n={3} label="Date" style={[s.cell, kit.colRule]}>
                <Text style={kit.value}>{issued}</Text>
              </Box>
              <Box n={4} label="Commercial invoice" style={s.cell}>
                <Text style={kit.value}>{invoice.invoiceNumber}</Text>
              </Box>
            </View>
            <View style={[kit.row, kit.rowRule]}>
              <Box n={5} label="Incoterms® 2020" style={s.cell}>
                <Text style={kit.value}>
                  {invoice.incoterm} {invoice.incotermPlace}
                </Text>
              </Box>
            </View>
            <View style={[kit.row, kit.rowRule]}>
              <Box n={6} label="Country of origin" style={[s.cell, kit.colRule]}>
                <Text style={kit.value}>{origins.length === 1 ? country(origins[0]!) : "Various"}</Text>
                {origins.length > 1 ? <Text style={kit.note}>Per item: {origins.join(", ")}</Text> : null}
              </Box>
              <Box n={7} label="Destination" style={s.cell}>
                <Text style={kit.value}>{country(invoice.destination)}</Text>
              </Box>
            </View>
            <View style={kit.row}>
              <Box n={8} label="Transport" style={[s.cell, kit.colRule]}>
                <Text style={kit.value}>{transport ? transport.vehicleRegistration : "Road"}</Text>
                {transport?.trailerRegistration ? <Text style={kit.note}>Trailer {transport.trailerRegistration}</Text> : null}
              </Box>
              <Box n={9} label="CMR" style={s.cell}>
                <Text style={kit.value}>{transport ? documentNumber(invoice.invoiceNumber, "CMR") : "—"}</Text>
              </Box>
            </View>
          </View>
        </View>

        <View style={s.table}>
          <View style={kit.tableHead} fixed>
            <Text style={[kit.th, s.cNo, kit.hairlineCol]}>No.</Text>
            <Text style={[kit.th, s.cMarks, kit.hairlineCol]}>Marks</Text>
            <Text style={[kit.th, s.cType, kit.hairlineCol]}>Package</Text>
            <Text style={[kit.th, s.cGoods, kit.hairlineCol]}>Contents (item)</Text>
            <Text style={[kit.th, s.cHs, kit.hairlineCol]}>HS code</Text>
            <Text style={[kit.th, s.cQty, kit.hairlineCol]}>Qty pcs</Text>
            <Text style={[kit.th, s.cNet, kit.hairlineCol]}>Net kg</Text>
            <Text style={[kit.th, s.cGross, kit.hairlineCol]}>Gross kg</Text>
            <Text style={[kit.th, s.cDims, kit.hairlineCol]}>L × W × H cm</Text>
            <Text style={[kit.th, s.cVol]}>m³</Text>
          </View>
          {packages.map((p, i) => {
            const line = lineOf(p.line);
            return (
              <View key={p.position} style={[kit.row, i > 0 ? { borderTopWidth: 0.5, borderTopColor: HAIRLINE } : {}]} wrap={false}>
                <Text style={[kit.td, s.cNo, kit.hairlineCol]}>{p.position}</Text>
                <Text style={[kit.td, s.cMarks, kit.hairlineCol, kit.strong]}>{p.marks}</Text>
                <Text style={[kit.td, s.cType, kit.hairlineCol]}>{packageTypeName(p.packageType)}</Text>
                <Text style={[kit.td, s.cGoods, s.goodsText, kit.hairlineCol]}>
                  {invoice.lines.length > 1 ? <Text style={kit.strong}>{p.line} · </Text> : null}
                  {line?.description}
                </Text>
                <Text style={[kit.td, s.cHs, kit.hairlineCol]}>{line?.hsCode}</Text>
                <Text style={[kit.td, s.cQty, kit.hairlineCol]}>{integer.format(p.quantity)}</Text>
                <Text style={[kit.td, s.cNet, kit.hairlineCol]}>{kilograms.format(p.netWeightKg)}</Text>
                <Text style={[kit.td, s.cGross, kit.hairlineCol]}>{kilograms.format(p.grossWeightKg)}</Text>
                <Text style={[kit.td, s.cDims, kit.hairlineCol]}>
                  {`${p.lengthCm}×${p.widthCm}×${p.heightCm}`}
                </Text>
                <Text style={[kit.td, s.cVol]}>{cubicMetres.format(packageVolumeM3(p))}</Text>
              </View>
            );
          })}
          <View style={s.totalRow} wrap={false}>
            <Text style={[kit.td, s.cNo, kit.hairlineCol]} />
            <Text style={[kit.td, s.cMarks, kit.hairlineCol, kit.strong]}>Total</Text>
            <Text style={[kit.td, s.cType, kit.hairlineCol, kit.strong]}>{integer.format(packages.length)}</Text>
            <Text style={[kit.td, s.cGoods, kit.hairlineCol]} />
            <Text style={[kit.td, s.cHs, kit.hairlineCol]} />
            <Text style={[kit.td, s.cQty, kit.hairlineCol, kit.strong]}>{integer.format(totals.quantity)}</Text>
            <Text style={[kit.td, s.cNet, kit.hairlineCol, kit.strong]}>{kilograms.format(totals.net)}</Text>
            <Text style={[kit.td, s.cGross, kit.hairlineCol, kit.strong]}>{kilograms.format(totals.gross)}</Text>
            <Text style={[kit.td, s.cDims, kit.hairlineCol]} />
            <Text style={[kit.td, s.cVol, kit.strong]}>{cubicMetres.format(totals.volume)}</Text>
          </View>
        </View>

        {dangerousGoods ? (
          <View style={s.adr} wrap={false}>
            <Text style={s.adrTag}>Dangerous goods (ADR)</Text>
            <Text style={kit.strong}>{adrDescription(dangerousGoods)}</Text>
          </View>
        ) : null}

        <View style={s.summary} wrap={false}>
          {[
            ["Packages", integer.format(packages.length)],
            ["Quantity", `${integer.format(totals.quantity)} pcs`],
            ["Net weight", `${kilograms.format(totals.net)} kg`],
            ["Gross weight", `${kilograms.format(totals.gross)} kg`],
            ["Volume", `${cubicMetres.format(totals.volume)} m³`],
          ].map(([label, value], i, all) => (
            <View key={label} style={[s.summaryCell, i < all.length - 1 ? kit.colRule : {}]}>
              <Text style={kit.label}>{label}</Text>
              <Text style={s.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={s.sign} wrap={false}>
          <View style={[s.signCell, kit.colRule]}>
            <Text style={kit.label}>Name and title of signatory</Text>
            <Text style={kit.value}>
              {invoice.signatory.name}
              {invoice.signatory.title ? `, ${invoice.signatory.title}` : ""}
            </Text>
          </View>
          <View style={[s.signCell, kit.colRule]}>
            <Text style={kit.label}>Place and date</Text>
            <Text style={kit.value}>
              {transport ? `${transport.takingOverPlace}, ` : ""}
              {issued}
            </Text>
          </View>
          <View style={s.signCell}>
            <Text style={kit.label}>Signature</Text>
            <View style={kit.signLine} />
          </View>
        </View>

        <Text style={[kit.note, { marginTop: 6 }]}>
          Weights and quantities agree with commercial invoice {invoice.invoiceNumber}
          {invoice.lines.length > 1 ? `, item by item` : ""}.{" "}
          {origins.length === 1 ? `Goods of ${regionName(origins[0]!)} origin.` : "Origin of each item as stated on the invoice."}
        </Text>

        <Footer left={`${number} · ${invoice.exporter.name}`} />
      </Page>
    </Document>
  );
}
