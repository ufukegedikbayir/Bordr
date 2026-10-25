import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { INCOTERMS, regionName, type InvoiceData, type InvoiceParty } from "@/services/customs/invoice";

import { country, formatDate, integer, kilograms, money } from "./kit";

export type CommercialInvoiceProps = {
  invoice: InvoiceData;
  /** The workspace logo (a data URI or URL); the exporter's name is printed without one. */
  logoUrl?: string | null;
};

const INK = "#0f172a";
const MUTED = "#475569";
const RULE = "#0f172a";
const HAIRLINE = "#94a3b8";
const TINT = "#f1f5f9";
const BORDER = 0.75;

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 56,
    paddingHorizontal: 36,
    fontFamily: "Plex",
    fontSize: 8.5,
    color: INK,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: RULE,
  },
  title: { fontWeight: 600, fontSize: 17, letterSpacing: 1.6 },
  subtitle: { marginTop: 2, fontSize: 8, color: MUTED, letterSpacing: 0.3 },
  brandLogo: { maxWidth: 160, maxHeight: 46, objectFit: "contain" },
  brandName: { maxWidth: 240, fontWeight: 600, fontSize: 12, textAlign: "right" },

  // Form grid: every box shares hairline borders like a customs form.
  grid: { flexDirection: "row", marginTop: 12, borderWidth: BORDER, borderColor: RULE },
  gridLeft: { width: "54%", borderRightWidth: BORDER, borderRightColor: RULE },
  gridRight: { width: "46%" },
  partyBox: { flexGrow: 1, padding: 7 },
  partyBoxDivider: { borderBottomWidth: BORDER, borderBottomColor: RULE },
  cellRow: { flexDirection: "row", flexGrow: 1, borderBottomWidth: BORDER, borderBottomColor: RULE },
  cellRowLast: { flexDirection: "row", flexGrow: 1 },
  cell: { flex: 1, padding: 7 },
  cellDivider: { borderRightWidth: BORDER, borderRightColor: RULE },

  label: { fontSize: 6.5, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase" },
  boxNumber: { fontWeight: 600, color: INK },
  value: { marginTop: 3, fontWeight: 600, fontSize: 9 },
  valueNote: { marginTop: 1, fontSize: 7.5, color: MUTED },
  partyName: { marginTop: 4, fontWeight: 600, fontSize: 9.5 },
  partyLine: { marginTop: 1 },
  partyIds: { marginTop: 5, flexDirection: "row", flexWrap: "wrap" },
  partyId: { marginRight: 12, marginTop: 1 },
  partyIdLabel: { color: MUTED },

  table: { marginTop: 12, borderWidth: BORDER, borderColor: RULE },
  tableHead: {
    flexDirection: "row",
    backgroundColor: TINT,
    borderBottomWidth: BORDER,
    borderBottomColor: RULE,
  },
  th: { paddingVertical: 5, paddingHorizontal: 5, fontSize: 6.5, color: MUTED, letterSpacing: 0.3, textTransform: "uppercase" },
  tr: { flexDirection: "row" },
  td: { paddingVertical: 6, paddingHorizontal: 5 },
  colDivider: { borderRightWidth: BORDER, borderRightColor: HAIRLINE },
  colNo: { width: 24, textAlign: "center" },
  colDescription: { flex: 1 },
  colHs: { width: 58 },
  colOrigin: { width: 38, textAlign: "center" },
  colQty: { width: 50, textAlign: "right" },
  colNet: { width: 52, textAlign: "right" },
  colUnit: { width: 62, textAlign: "right" },
  colAmount: { width: 72, textAlign: "right" },
  strong: { fontWeight: 600 },

  totals: {
    flexDirection: "row",
    borderTopWidth: BORDER,
    borderTopColor: RULE,
  },
  totalsLabel: { flex: 1, paddingVertical: 6, paddingHorizontal: 5, textAlign: "right" },
  totalsValue: { width: 72, paddingVertical: 6, paddingHorizontal: 5, textAlign: "right", fontWeight: 600 },
  totalsNote: { marginTop: 4, fontSize: 7.5, color: MUTED, textAlign: "right" },

  declaration: { marginTop: 14, borderWidth: BORDER, borderColor: RULE },
  declarationBody: { padding: 7 },
  declarationText: { marginTop: 4, fontSize: 8.5, lineHeight: 1.45 },
  signRow: { flexDirection: "row", borderTopWidth: BORDER, borderTopColor: RULE },
  signCell: { flex: 1, padding: 7, minHeight: 58, justifyContent: "space-between" },
  signValue: { fontWeight: 600, fontSize: 9 },
  signLine: { borderBottomWidth: 0.5, borderBottomColor: HAIRLINE, height: 18 },
  stampCell: { width: 120, padding: 7, minHeight: 58 },

  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    fontSize: 7,
    color: MUTED,
  },
});

function Label({ n, children }: { n?: number; children: string }) {
  return (
    <Text style={styles.label}>
      {n !== undefined && <Text style={styles.boxNumber}>{n} </Text>}
      {children}
    </Text>
  );
}

function Cell({
  n,
  label,
  value,
  note,
  divider,
}: {
  n: number;
  label: string;
  value: string;
  note?: string;
  divider?: boolean;
}) {
  return (
    <View style={divider ? [styles.cell, styles.cellDivider] : styles.cell}>
      <Label n={n}>{label}</Label>
      <Text style={styles.value}>{value}</Text>
      {note ? <Text style={styles.valueNote}>{note}</Text> : null}
    </View>
  );
}

function Party({ n, label, party, divider }: { n: number; label: string; party: InvoiceParty; divider?: boolean }) {
  return (
    <View style={divider ? [styles.partyBox, styles.partyBoxDivider] : styles.partyBox}>
      <Label n={n}>{label}</Label>
      <Text style={styles.partyName}>{party.name}</Text>
      {party.address.split("\n").map((line, i) => (
        <Text key={i} style={styles.partyLine}>
          {line}
        </Text>
      ))}
      <Text style={styles.partyLine}>{country(party.country)}</Text>
      <View style={styles.partyIds}>
        <Text style={styles.partyId}>
          <Text style={styles.partyIdLabel}>EORI </Text>
          {party.eori ?? "—"}
        </Text>
        <Text style={styles.partyId}>
          <Text style={styles.partyIdLabel}>VAT / Tax ID </Text>
          {party.taxId ?? "—"}
        </Text>
      </View>
    </View>
  );
}

/** A commercial invoice laid out as a customs form: numbered boxes, one line per HS code. */
export function CommercialInvoice({ invoice, logoUrl }: CommercialInvoiceProps) {
  const { line, currency } = invoice;
  const total = line.quantity * line.unitPrice;
  const incoterm = INCOTERMS.find(({ code }) => code === invoice.incoterm);
  const terms = `${invoice.incoterm} ${invoice.incotermPlace}`;
  const issued = formatDate(invoice.issuedAt);

  return (
    <Document
      title={`Commercial Invoice ${invoice.invoiceNumber}`}
      author={invoice.exporter.name}
      subject="Commercial Invoice"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>COMMERCIAL INVOICE</Text>
            <Text style={styles.subtitle}>For customs clearance · International road freight</Text>
          </View>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image src={logoUrl} style={styles.brandLogo} />
          ) : (
            <Text style={styles.brandName}>{invoice.exporter.name}</Text>
          )}
        </View>

        <View style={styles.grid}>
          <View style={styles.gridLeft}>
            <Party n={1} label="Exporter / Seller" party={invoice.exporter} divider />
            <Party n={2} label="Consignee / Buyer" party={invoice.consignee} />
          </View>

          <View style={styles.gridRight}>
            <View style={styles.cellRow}>
              <Cell n={3} label="Invoice number" value={invoice.invoiceNumber} divider />
              <Cell n={4} label="Invoice date" value={issued} />
            </View>
            <View style={styles.cellRow}>
              <Cell n={5} label="Incoterms® 2020" value={terms} note={incoterm?.name} />
            </View>
            <View style={styles.cellRow}>
              <Cell n={6} label="Country of origin" value={country(invoice.originCountry)} divider />
              <Cell n={7} label="Country of destination" value={country(invoice.destination)} />
            </View>
            <View style={styles.cellRow}>
              <Cell n={8} label="Currency" value={currency} divider />
              <Cell n={9} label="Mode of transport" value="Road" />
            </View>
            <View style={styles.cellRow}>
              <Cell n={10} label="Packages" value={integer.format(invoice.packageCount)} divider />
              <Cell n={11} label="Gross weight" value={`${kilograms.format(invoice.grossWeightKg)} kg`} />
            </View>
            <View style={styles.cellRowLast}>
              <Cell n={12} label="Net weight" value={`${kilograms.format(invoice.netWeightKg)} kg`} />
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.colNo, styles.colDivider]}>No.</Text>
            <Text style={[styles.th, styles.colDescription, styles.colDivider]}>Description of goods</Text>
            <Text style={[styles.th, styles.colHs, styles.colDivider]}>HS code</Text>
            <Text style={[styles.th, styles.colOrigin, styles.colDivider]}>Origin</Text>
            <Text style={[styles.th, styles.colQty, styles.colDivider]}>Quantity</Text>
            <Text style={[styles.th, styles.colNet, styles.colDivider]}>Net kg</Text>
            <Text style={[styles.th, styles.colUnit, styles.colDivider]}>Unit price</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount {currency}</Text>
          </View>

          <View style={styles.tr} wrap={false}>
            <Text style={[styles.td, styles.colNo, styles.colDivider]}>1</Text>
            <Text style={[styles.td, styles.colDescription, styles.colDivider]}>{line.description}</Text>
            <Text style={[styles.td, styles.colHs, styles.colDivider, styles.strong]}>{line.hsCode}</Text>
            <Text style={[styles.td, styles.colOrigin, styles.colDivider]}>{invoice.originCountry}</Text>
            <Text style={[styles.td, styles.colQty, styles.colDivider]}>{integer.format(line.quantity)} pcs</Text>
            <Text style={[styles.td, styles.colNet, styles.colDivider]}>{kilograms.format(invoice.netWeightKg)}</Text>
            <Text style={[styles.td, styles.colUnit, styles.colDivider]}>{money.format(line.unitPrice)}</Text>
            <Text style={[styles.td, styles.colAmount, styles.strong]}>{money.format(total)}</Text>
          </View>

          <View style={styles.totals} wrap={false}>
            <Text style={[styles.totalsLabel, styles.strong]}>Total invoice value ({currency})</Text>
            <Text style={styles.totalsValue}>{money.format(total)}</Text>
          </View>
        </View>
        <Text style={styles.totalsNote}>
          Prices are stated on {terms} terms (Incoterms® 2020).
        </Text>

        <View style={styles.declaration} wrap={false}>
          <View style={styles.declarationBody}>
            <Label n={13}>Declaration</Label>
            <Text style={styles.declarationText}>
              We hereby certify that this invoice shows the actual price of the goods described, that
              all particulars shown are true and correct, and that the country of origin of the goods
              is {regionName(invoice.originCountry)}.
            </Text>
          </View>
          <View style={styles.signRow}>
            <View style={[styles.signCell, styles.cellDivider]}>
              <Label>Name and title of signatory</Label>
              <Text style={styles.signValue}>
                {invoice.signatory.name}
                {invoice.signatory.title ? `, ${invoice.signatory.title}` : ""}
              </Text>
            </View>
            <View style={[styles.signCell, styles.cellDivider]}>
              <Label>Place and date</Label>
              <Text style={styles.signValue}>{issued}</Text>
            </View>
            <View style={[styles.signCell, styles.cellDivider]}>
              <Label>Signature</Label>
              <View style={styles.signLine} />
            </View>
            <View style={styles.stampCell}>
              <Label>Company stamp</Label>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {invoice.invoiceNumber} · {invoice.exporter.name}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
