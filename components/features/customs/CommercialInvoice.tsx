import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { countryName, type CountryCode } from "@/services/customs/constants";

// Never hyphenate words mid-line: legal documents should wrap whole words only.
Font.registerHyphenationCallback((word) => [word]);

export type CommercialInvoiceProps = {
  description: string;
  country: CountryCode;
  hsCode: string;
  hsDescription: string;
  estimatedDuty: string;
  issuedAt: Date;
  /** The workspace logo (a data URI or URL); the text header is used without one. */
  logoUrl?: string | null;
};

type Party = { name: string; lines: string[]; country: string; meta?: string };

// Placeholder parties until business profiles and consignee entry exist.
// Fictional; the footer says so on every page.
const EXPORTER: Party = {
  name: "Sample Exporter Pte. Ltd.",
  lines: ["1 Placeholder Way, #01-01", "Singapore 018989"],
  country: "Singapore",
  meta: "Tax / customs ID: 000000000X",
};

const CONSIGNEES: Record<CountryCode, Omit<Party, "country">> = {
  US: { name: "Northwind Imports LLC", lines: ["1200 Example Avenue", "Chicago, IL 60601"] },
  GB: { name: "Northwind Imports Ltd.", lines: ["10 Example Street", "London EC1A 1AA"] },
  DE: { name: "Northwind Importe GmbH", lines: ["Beispielstrasse 12", "10115 Berlin"] },
  CA: { name: "Northwind Imports Inc.", lines: ["88 Example Road", "Toronto, ON M5V 2T6"] },
};

const INVOICE_NUMBER = "INV-000001";
const QUANTITY = 1;
const UNIT_VALUE = 100;

const INK = "#0f172a";
const MUTED = "#64748b";
const RULE = "#cbd5e1";
const TINT = "#f8fafc";

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 72,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
    // No page-level lineHeight: in react-pdf it hides the `fixed` footer.
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: INK,
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: -0.4 },
  titleSub: { marginTop: 4, fontSize: 9, color: MUTED },
  brand: { alignItems: "flex-end" },
  brandName: { fontFamily: "Helvetica-Bold", fontSize: 15, letterSpacing: -0.3 },
  // A box the logo scales down into, whatever its aspect ratio.
  brandLogo: { maxWidth: 150, maxHeight: 44, objectFit: "contain" },
  sampleTag: {
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: INK,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
  },

  parties: { flexDirection: "row", marginTop: 18 },
  partyBox: { flex: 1, padding: 11, borderWidth: 1, borderColor: RULE },
  partyBoxGap: { marginRight: 12 },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    color: MUTED,
    textTransform: "uppercase",
  },
  partyName: { marginTop: 5, fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  partyMeta: { marginTop: 5, color: MUTED },

  metaGrid: { flexDirection: "row", marginTop: 12, borderWidth: 1, borderColor: RULE },
  metaCell: { flex: 1, padding: 9 },
  metaCellDivider: { borderRightWidth: 1, borderRightColor: RULE },
  metaValue: { marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 10 },

  table: { marginTop: 18, borderWidth: 1, borderColor: RULE },
  tableHead: { flexDirection: "row", backgroundColor: INK },
  tableHeadText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 0.9,
    color: "#ffffff",
    textTransform: "uppercase",
  },
  tableRow: { flexDirection: "row", backgroundColor: TINT },
  cell: { paddingVertical: 9, paddingHorizontal: 9 },
  colDescription: { flex: 4 },
  colHs: { flex: 1.6 },
  colOrigin: { flex: 1.5 },
  colQty: { flex: 0.7, textAlign: "right" },
  colUnit: { flex: 1.3, textAlign: "right" },
  colTotal: { flex: 1.3, textAlign: "right" },
  mono: { fontFamily: "Courier-Bold", fontSize: 9.5 },
  cellSub: { marginTop: 3, fontSize: 7.5, color: MUTED },

  totals: { marginTop: 14, alignItems: "flex-end" },
  totalsBox: { width: 230, borderWidth: 1, borderColor: RULE },
  totalsRowFirst: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: INK,
    color: "#ffffff",
  },
  totalsRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  strong: { fontFamily: "Helvetica-Bold" },
  totalsNote: { width: 230, marginTop: 6, fontSize: 7.5, color: MUTED, textAlign: "right" },

  declaration: { marginTop: 26 },
  declarationText: { marginTop: 5 },
  signatureRow: { flexDirection: "row", marginTop: 28 },
  signatureField: { flex: 1, marginRight: 24 },
  signatureFieldLast: { flex: 1 },
  signatureLine: { height: 22, borderBottomWidth: 1, borderBottomColor: INK },
  signatureLabel: { marginTop: 4, fontSize: 7.5, color: MUTED },

  footer: {
    position: "absolute",
    left: 44,
    right: 44,
    bottom: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: RULE,
    fontSize: 7.5,
    color: MUTED,
  },
  footerText: { flex: 1, marginRight: 16 },
  footerStrong: { fontFamily: "Helvetica-Bold", color: INK },
});

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function usd(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function PartyBlock({ label, party, gap }: { label: string; party: Party; gap?: boolean }) {
  return (
    <View style={gap ? [styles.partyBox, styles.partyBoxGap] : styles.partyBox}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      {party.lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      <Text>{party.country}</Text>
      {party.meta ? <Text style={styles.partyMeta}>{party.meta}</Text> : null}
    </View>
  );
}

export function CommercialInvoice({
  description,
  country,
  hsCode,
  hsDescription,
  estimatedDuty,
  issuedAt,
  logoUrl,
}: CommercialInvoiceProps) {
  const destination = countryName(country);
  const consignee: Party = { ...CONSIGNEES[country], country: destination };
  const total = QUANTITY * UNIT_VALUE;
  const rate = Number.parseFloat(estimatedDuty);
  const dutyAmount = Number.isFinite(rate) ? (total * rate) / 100 : 0;

  return (
    <Document
      title={`Commercial Invoice ${INVOICE_NUMBER}`}
      author="Bordr"
      subject="Commercial Invoice"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Commercial Invoice</Text>
            <Text style={styles.titleSub}>For international customs clearance</Text>
          </View>
          <View style={styles.brand}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={logoUrl} style={styles.brandLogo} />
            ) : (
              <Text style={styles.brandName}>Bordr</Text>
            )}
            <Text style={styles.sampleTag}>SAMPLE DATA</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <PartyBlock label="Exporter / Sender" party={EXPORTER} gap />
          <PartyBlock label="Consignee / Receiver" party={consignee} />
        </View>

        <View style={styles.metaGrid}>
          <View style={[styles.metaCell, styles.metaCellDivider]}>
            <Text style={styles.label}>Invoice Number</Text>
            <Text style={styles.metaValue}>{INVOICE_NUMBER}</Text>
          </View>
          <View style={[styles.metaCell, styles.metaCellDivider]}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.metaValue}>{formatDate(issuedAt)}</Text>
          </View>
          <View style={[styles.metaCell, styles.metaCellDivider]}>
            <Text style={styles.label}>Country of Origin</Text>
            <Text style={styles.metaValue}>{EXPORTER.country}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>Destination</Text>
            <Text style={styles.metaValue}>{destination}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.cell, styles.tableHeadText, styles.colDescription]}>
              Product Description
            </Text>
            <Text style={[styles.cell, styles.tableHeadText, styles.colHs]}>HS Code</Text>
            <Text style={[styles.cell, styles.tableHeadText, styles.colOrigin]}>Origin</Text>
            <Text style={[styles.cell, styles.tableHeadText, styles.colQty]}>Qty</Text>
            <Text style={[styles.cell, styles.tableHeadText, styles.colUnit]}>Unit Value</Text>
            <Text style={[styles.cell, styles.tableHeadText, styles.colTotal]}>Total</Text>
          </View>
          <View style={styles.tableRow} wrap={false}>
            <Text style={[styles.cell, styles.colDescription]}>{description}</Text>
            <View style={[styles.cell, styles.colHs]}>
              <Text style={styles.mono}>{hsCode}</Text>
              <Text style={styles.cellSub}>{hsDescription}</Text>
            </View>
            <Text style={[styles.cell, styles.colOrigin]}>{EXPORTER.country}</Text>
            <Text style={[styles.cell, styles.colQty]}>{QUANTITY}</Text>
            <Text style={[styles.cell, styles.colUnit]}>{usd(UNIT_VALUE)}</Text>
            <Text style={[styles.cell, styles.colTotal, styles.strong]}>{usd(total)}</Text>
          </View>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRowFirst}>
              <Text style={styles.strong}>Invoice Total (USD)</Text>
              <Text style={styles.strong}>{usd(total)}</Text>
            </View>
            <View style={styles.totalsRowLast}>
              <Text>Estimated Duty ({estimatedDuty})</Text>
              <Text style={styles.strong}>{usd(dutyAmount)}</Text>
            </View>
          </View>
          <Text style={styles.totalsNote}>
            Duty is an estimate on the declared value and is not a final assessment.
          </Text>
        </View>

        <View style={styles.declaration} wrap={false}>
          <Text style={styles.label}>Declaration</Text>
          <Text style={styles.declarationText}>
            I declare that the information on this invoice is true and correct and that the
            goods described are of the stated origin.
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureField}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorised signature</Text>
            </View>
            <View style={styles.signatureField}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Name and title</Text>
            </View>
            <View style={styles.signatureFieldLast}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Date</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            <Text style={styles.footerStrong}>Placeholder data. </Text>
            The exporter, consignee, invoice number, quantity, declared value and origin on this
            invoice are fictional sample values, not your shipment details. The HS code and duty
            are AI-generated estimates. Replace and verify every field before filing.
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
