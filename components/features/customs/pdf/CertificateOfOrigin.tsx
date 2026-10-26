import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { packageGroups, type ShipmentDocuments } from "@/services/customs/documents";
import { documentNumber, packageTypeName } from "@/services/customs/freight";
import { regionName } from "@/services/customs/invoice";

import { BORDER, Box, DocumentHeader, Footer, HAIRLINE, MUTED, Party, RULE, formatDate, integer, kilograms, kit } from "./kit";

const s = StyleSheet.create({
  notice: {
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderWidth: BORDER,
    borderColor: RULE,
    borderStyle: "dashed",
    fontSize: 7.5,
    lineHeight: 1.4,
  },
  frame: { marginTop: 8, borderWidth: BORDER, borderColor: RULE },
  left: { width: "55%" },
  right: { width: "45%" },
  minParty: { minHeight: 74 },
  origin: { marginTop: 6, fontWeight: 600, fontSize: 18, letterSpacing: 0.5 },
  originCode: { marginTop: 1, color: MUTED },

  goodsHead: { flexDirection: "row", borderBottomWidth: BORDER, borderBottomColor: RULE },
  cItems: { flex: 1 },
  cQty: { width: 130 },
  itemRow: { flexDirection: "row" },
  item: { flexDirection: "row" },
  itemNo: { width: 16, fontWeight: 600 },
  itemBody: { flex: 1 },
  minGoods: { minHeight: 150 },

  // A unitless lineHeight scales react-pdf's default 18pt unless fontSize is set alongside it.
  declaration: { fontSize: 8, lineHeight: 1.4, marginTop: 3 },
  signRow: { flexDirection: "row", marginTop: 8 },
  signCell: { flex: 1, marginRight: 10 },
  authority: { minHeight: 110 },
  reserved: { marginTop: 4, color: MUTED, fontSize: 7 },
  authorityLines: { flexDirection: "row", marginTop: 34 },
  authorityLine: { flex: 1, marginRight: 14, borderTopWidth: 0.5, borderTopColor: HAIRLINE, paddingTop: 2, fontSize: 6.5, color: MUTED },
});

/** "Pallets" -> "pallets", but "EUR pallets" and "IBCs" keep their capitals. */
function lowerFirst(name: string) {
  return /^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

/**
 * The exporter's application for a non-preferential certificate of origin,
 * with the standard boxes 1–7 filled in. Only the issuing authority (a chamber
 * of commerce) can certify it, in box 8: until then it is not a certificate.
 */
export function CertificateOfOrigin({ data }: { data: ShipmentDocuments }) {
  const { invoice, packages, transport } = data;
  const number = documentNumber(invoice.invoiceNumber, "COO");
  const groups = packageGroups(packages);
  const originName = regionName(invoice.originCountry);
  const issued = formatDate(invoice.issuedAt);

  return (
    <Document title={`Certificate of origin application ${number}`} author={invoice.exporter.name} subject="Certificate of origin">
      <Page size="A4" style={kit.page}>
        <DocumentHeader
          title="CERTIFICATE OF ORIGIN"
          subtitle="Application · Non-preferential origin"
          numberLabel="Application no."
          number={number}
        />

        <Text style={s.notice}>
          <Text style={kit.strong}>Application, not yet a certificate. </Text>
          It becomes a certificate of origin only when the issuing authority (chamber of commerce) certifies it in box 8, on
          its official form or electronic system. Box 8 is reserved for that authority.
        </Text>

        <View style={s.frame}>
          <View style={[kit.row, kit.rowRule]}>
            <Box n={1} label="Consignor" style={[s.left, s.minParty, kit.colRule]}>
              <Party party={{ ...invoice.exporter, ids: [["EORI", invoice.exporter.eori], ["VAT", invoice.exporter.taxId]] }} />
            </Box>
            <Box n={3} label="Country of origin" style={[s.right, s.minParty]}>
              <Text style={s.origin}>{originName.toUpperCase()}</Text>
              <Text style={s.originCode}>ISO code {invoice.originCountry}</Text>
            </Box>
          </View>

          <View style={[kit.row, kit.rowRule]}>
            <Box n={2} label="Consignee" style={[s.left, s.minParty, kit.colRule]}>
              <Party party={invoice.consignee} />
            </Box>
            <Box n={4} label="Transport details (optional)" style={[s.right, s.minParty]}>
              <Text style={kit.value}>By road</Text>
              {transport ? (
                <>
                  <Text style={kit.line}>
                    Vehicle {transport.vehicleRegistration}
                    {transport.trailerRegistration ? ` / ${transport.trailerRegistration}` : ""}
                  </Text>
                  <Text style={kit.line}>From {transport.takingOverPlace}</Text>
                  <Text style={kit.line}>To {transport.deliveryPlace}, {regionName(invoice.destination)}</Text>
                  <Text style={kit.line}>CMR {documentNumber(invoice.invoiceNumber, "CMR")}</Text>
                </>
              ) : (
                <Text style={kit.line}>To {regionName(invoice.destination)}</Text>
              )}
            </Box>
          </View>

          <View style={kit.rowRule}>
            <Box n={5} label="Remarks (optional)">
              <Text style={kit.line}>
                Commercial invoice {invoice.invoiceNumber} of {issued}. Packing list {documentNumber(invoice.invoiceNumber, "PL")}.
              </Text>
            </Box>
          </View>

          <View style={kit.rowRule}>
            <View style={s.goodsHead}>
              <Box n={6} label="Item number; marks, numbers, number and kind of packages; description of goods" style={[s.cItems, kit.colRule]} />
              <Box n={7} label="Quantity" style={s.cQty} />
            </View>
            <View style={[s.itemRow, s.minGoods]}>
              <View style={[s.cItems, kit.box, kit.colRule]}>
                <View style={s.item}>
                  <Text style={s.itemNo}>1</Text>
                  <View style={s.itemBody}>
                    <Text style={kit.strong}>{invoice.line.description}</Text>
                    <Text style={kit.line}>HS {invoice.line.hsCode}</Text>
                    {groups.map((group) => (
                      <Text key={group.packageType} style={kit.line}>
                        {integer.format(group.count)} {lowerFirst(packageTypeName(group.packageType, group.count))}, marks{" "}
                        {group.marks.length > 4 ? `${group.marks[0]} to ${group.marks[group.marks.length - 1]}` : group.marks.join(", ")}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
              <View style={[s.cQty, kit.box]}>
                <Text style={kit.strong}>{integer.format(invoice.line.quantity)} pcs</Text>
                <Text style={kit.line}>Gross {kilograms.format(invoice.grossWeightKg)} kg</Text>
                <Text style={kit.line}>Net {kilograms.format(invoice.netWeightKg)} kg</Text>
              </View>
            </View>
          </View>

          <View style={kit.rowRule}>
            <Box label="Application and declaration by the exporter">
              <Text style={s.declaration}>
                The undersigned, acting for the consignor named in box 1, declares that the goods described above originate in{" "}
                <Text style={kit.strong}>{originName}</Text>, that the particulars given are true and correct, and applies for a certificate of origin for them.
              </Text>
              <View style={s.signRow}>
                <View style={s.signCell}>
                  <Text style={kit.label}>Name and title</Text>
                  <Text style={kit.value}>
                    {invoice.signatory.name}
                    {invoice.signatory.title ? `, ${invoice.signatory.title}` : ""}
                  </Text>
                </View>
                <View style={s.signCell}>
                  <Text style={kit.label}>Place and date</Text>
                  <Text style={kit.value}>
                    {transport ? `${transport.takingOverPlace}, ` : ""}
                    {issued}
                  </Text>
                </View>
                <View style={s.signCell}>
                  <Text style={kit.label}>Signature and company stamp</Text>
                  <View style={kit.signLine} />
                </View>
              </View>
            </Box>
          </View>

          <Box n={8} label="Reserved for the issuing authority" style={s.authority}>
            <Text style={s.reserved}>To be completed by the chamber of commerce. Leave blank.</Text>
            <View style={s.authorityLines}>
              <Text style={s.authorityLine}>Place and date of issue</Text>
              <Text style={s.authorityLine}>Name of the certifying authority</Text>
              <Text style={s.authorityLine}>Stamp and signature</Text>
            </View>
          </Box>
        </View>

        <Footer left={`${number} · Application, not valid until certified · ${invoice.exporter.name}`} />
      </Page>
    </Document>
  );
}
