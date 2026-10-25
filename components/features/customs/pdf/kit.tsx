// Shared by every freight document: fonts, design tokens, number formats and
// the numbered-box primitives customs forms are built from.
import type { ComponentProps, ReactNode } from "react";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";

import { regionName } from "@/services/customs/invoice";

// Plex covers Latin Extended (ł, ş, ő, č …), which the built-in Helvetica
// can't draw, so real company names and addresses print correctly. The
// server path exists for rendering the templates in Node (tests, scripts).
const FONT_BASE =
  typeof window === "undefined" ? `${globalThis.process?.cwd?.() ?? ""}/public/fonts` : "/fonts";

Font.register({
  family: "Plex",
  fonts: [
    { src: `${FONT_BASE}/IBMPlexSans-Regular.woff`, fontWeight: 400 },
    { src: `${FONT_BASE}/IBMPlexSans-SemiBold.woff`, fontWeight: 600 },
  ],
});

// Never hyphenate words mid-line: legal documents wrap whole words only.
Font.registerHyphenationCallback((word) => [word]);

export const INK = "#0f172a";
export const MUTED = "#475569";
export const RULE = "#0f172a";
export const HAIRLINE = "#94a3b8";
export const TINT = "#f1f5f9";
export const BORDER = 0.75;

export const money = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const kilograms = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const cubicMetres = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const integer = new Intl.NumberFormat("en-GB");

// Unambiguous across locales ("25 October 2026"), and pinned to UTC like the record.
export function formatDate(isoOrDate: string) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate) ? `${isoOrDate}T00:00:00Z` : isoOrDate;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function country(code: string) {
  return `${regionName(code)} (${code})`;
}

export const kit = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 52,
    paddingHorizontal: 32,
    fontFamily: "Plex",
    fontSize: 8,
    color: INK,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 9,
    borderBottomWidth: 1.5,
    borderBottomColor: RULE,
  },
  title: { fontWeight: 600, fontSize: 16, letterSpacing: 1.5 },
  subtitle: { marginTop: 2, fontSize: 7.5, color: MUTED, letterSpacing: 0.3 },
  docNumber: { fontWeight: 600, fontSize: 10, textAlign: "right" },
  docNumberLabel: { fontSize: 6.5, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase", textAlign: "right" },

  frame: { borderWidth: BORDER, borderColor: RULE },
  row: { flexDirection: "row" },
  rowRule: { borderBottomWidth: BORDER, borderBottomColor: RULE },
  colRule: { borderRightWidth: BORDER, borderRightColor: RULE },
  box: { padding: 6 },

  label: { fontSize: 6, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase" },
  boxNumber: { fontWeight: 600, color: INK },
  value: { marginTop: 2.5, fontWeight: 600, fontSize: 8.5 },
  line: { marginTop: 1 },
  note: { marginTop: 1.5, fontSize: 7, color: MUTED },
  strong: { fontWeight: 600 },
  muted: { color: MUTED },

  th: { paddingVertical: 4, paddingHorizontal: 4, fontSize: 6, color: MUTED, letterSpacing: 0.3, textTransform: "uppercase" },
  td: { paddingVertical: 4.5, paddingHorizontal: 4 },
  tableHead: { flexDirection: "row", backgroundColor: TINT, borderBottomWidth: BORDER, borderBottomColor: RULE },
  hairlineCol: { borderRightWidth: BORDER, borderRightColor: HAIRLINE },
  hairlineRow: { borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  right: { textAlign: "right" },
  center: { textAlign: "center" },

  signLine: { borderBottomWidth: 0.5, borderBottomColor: HAIRLINE, height: 20 },

  footer: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    fontSize: 6.5,
    color: MUTED,
  },
});

/** "1 Sender": the box number in ink, the caption muted, like printed forms. */
export function Label({ n, children }: { n?: number | string; children: ReactNode }) {
  return (
    <Text style={kit.label}>
      {n !== undefined && <Text style={kit.boxNumber}>{n} </Text>}
      {children}
    </Text>
  );
}

type ViewStyle = ComponentProps<typeof View>["style"];

/** A numbered form box. `style` sets its width, rules and height. */
export function Box({ n, label, children, style }: { n?: number | string; label: ReactNode; children?: ReactNode; style?: ViewStyle }) {
  const extra = Array.isArray(style) ? style : style ? [style] : [];
  return (
    <View style={[kit.box, ...extra]}>
      <Label n={n}>{label}</Label>
      {children}
    </View>
  );
}

export type PartyLines = { name: string; address: string; country: string; ids?: Array<[string, string | null]> };

/** Name, address lines, country and identifiers, as printed in a party box. */
export function Party({ party }: { party: PartyLines }) {
  return (
    <View>
      <Text style={kit.value}>{party.name}</Text>
      {party.address.split("\n").map((line, i) => (
        <Text key={i} style={kit.line}>
          {line}
        </Text>
      ))}
      <Text style={kit.line}>{country(party.country)}</Text>
      {party.ids && party.ids.some(([, v]) => v) ? (
        <Text style={[kit.line, { marginTop: 3 }]}>
          {party.ids
            .filter(([, v]) => v)
            .map(([k, v]) => `${k} ${v}`)
            .join("   ")}
        </Text>
      ) : null}
    </View>
  );
}

export function DocumentHeader({ title, subtitle, numberLabel, number, aside }: { title: string; subtitle: string; numberLabel: string; number: string; aside?: ReactNode }) {
  return (
    <View style={kit.header}>
      <View>
        <Text style={kit.title}>{title}</Text>
        <Text style={kit.subtitle}>{subtitle}</Text>
      </View>
      <View>
        {aside}
        <Text style={kit.docNumberLabel}>{numberLabel}</Text>
        <Text style={kit.docNumber}>{number}</Text>
      </View>
    </View>
  );
}

export function Footer({ left }: { left: string }) {
  return (
    <View style={kit.footer} fixed>
      <Text>{left}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
