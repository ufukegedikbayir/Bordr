// What the user declares for a shipment: validated live in the form and again
// in the Server Action, with the same schema. The database enforces the same
// rules once more (see supabase/migrations/*_freight_documents.sql).
import { z } from "zod";

import { collapse, collapseLines, isCleanLines, isCleanText, tidy, SYMBOLS_MESSAGE } from "@/lib/validation/text";

import { DESTINATIONS, MAX_DESCRIPTION_LENGTH, MAX_LINES, type CountryCode } from "./constants";
import {
  ADR_CLASSES,
  MAX_PACKAGES,
  MAX_PAYLOAD_KG,
  MAX_PAYLOAD_M3,
  PACKAGE_LIMITS_CM,
  PACKAGE_TYPES,
  PACKING_GROUPS,
  TUNNEL_CODES,
  type AdrClass,
  type DangerousGoods,
  type PackageType,
} from "./freight";
import { CURRENCIES, INCOTERMS, TAX_ID_PATTERN, isIsoCountry, type Incoterm } from "./invoice";

// ---------------------------------------------------------------------------
// Form values: everything is a string until validated
// ---------------------------------------------------------------------------

/** One invoice line: what the goods are, what they cost, where they were made. */
export type LineFormValues = {
  description: string;
  unitPrice: string;
  originCountry: string;
};

export type PackageFormValues = {
  /** Item number ("1", "2", …) of the line whose goods the package carries. */
  line: string;
  packageType: string;
  marks: string;
  quantity: string;
  netWeightKg: string;
  grossWeightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

export type ShipmentFormValues = {
  lines: LineFormValues[];
  currency: string;
  country: string;
  incoterm: string;
  incotermPlace: string;
  deliveryPlace: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeTaxId: string;
  carrierName: string;
  carrierAddress: string;
  carrierCountry: string;
  vehicleRegistration: string;
  trailerRegistration: string;
  takingOverPlace: string;
  takingOverDate: string;
  senderInstructions: string;
  dangerous: "yes" | "no";
  unNumber: string;
  shippingName: string;
  hazardClass: string;
  packingGroup: string;
  tunnelCode: string;
  packages: PackageFormValues[];
};

export type ScalarField = Exclude<keyof ShipmentFormValues, "packages" | "lines">;
export type LineField = keyof LineFormValues;
export type PackageField = keyof PackageFormValues;

/** Error keys are dotted paths: "carrierName", "lines.1.unitPrice", "packages.2.grossWeightKg". */
export type FieldErrors = Partial<Record<string, string[]>>;

export function linePath(index: number, field?: LineField) {
  return field ? `lines.${index}.${field}` : `lines.${index}`;
}

export function packagePath(index: number, field: PackageField) {
  return `packages.${index}.${field}`;
}

/** Typing masks: only changes the user can't object to (case, stray spaces). */
export const SHIPMENT_MASKS: Partial<Record<ScalarField | LineField | PackageField, (value: string) => string>> = {
  consigneeTaxId: (v) => tidy(v).toUpperCase(),
  vehicleRegistration: (v) => tidy(v).toUpperCase(),
  trailerRegistration: (v) => tidy(v).toUpperCase(),
  // The document prints the "UN" prefix itself.
  unNumber: (v) => v.toUpperCase().replace(/^UN\s*/, "").replace(/\s/g, ""),
  // Proper shipping names are written in capitals, as in ADR Table A.
  shippingName: (v) => tidy(v).toUpperCase(),
  marks: (v) => tidy(v).toUpperCase(),
};

export const EMPTY_LINE: LineFormValues = { description: "", unitPrice: "", originCountry: "" };

export const EMPTY_PACKAGE: PackageFormValues = {
  line: "1",
  packageType: "eur_pallet",
  marks: "",
  quantity: "",
  netWeightKg: "",
  grossWeightKg: "",
  lengthCm: "120",
  widthCm: "80",
  heightCm: "",
};

/** "RF-01" -> "RF-02": the next package usually carries the next number. */
export function nextMarks(marks: string): string {
  const match = marks.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return marks;
  const [, head, digits, tail] = match;
  const next = String(Number(digits) + 1).padStart(digits!.length, "0");
  return `${head}${next}${tail}`;
}

// ---------------------------------------------------------------------------
// Field rules
// ---------------------------------------------------------------------------

const text = (what: string, max: number) =>
  z
    .string()
    .transform(collapse)
    .pipe(
      z
        .string()
        .min(1, `Enter ${what}.`)
        .refine(isCleanText, SYMBOLS_MESSAGE)
        .max(max, `Use at most ${max} characters.`),
    );

const lines = (what: string, max: number) =>
  z
    .string()
    .transform(collapseLines)
    .pipe(
      z
        .string()
        .min(1, `Enter ${what}.`)
        .refine(isCleanLines, SYMBOLS_MESSAGE)
        .max(max, `Use at most ${max} characters.`),
    );

const optionalLines = (max: number) =>
  z
    .string()
    .transform(collapseLines)
    .pipe(
      z.union([
        z.literal(""),
        z.string().refine(isCleanLines, SYMBOLS_MESSAGE).max(max, `Use at most ${max} characters.`),
      ]),
    )
    .transform((v) => v || null);

/** Accepts "1 234,5" or "1234.5"; rounds to `decimals`. */
const amount = (what: string, decimals: number, max: number) =>
  z.preprocess(
    // Blank becomes undefined so it reads "Enter …" rather than "must be more than zero".
    (value) => (typeof value === "string" ? value.replace(/\s/g, "").replace(",", ".") || undefined : value),
    z.coerce
      .number({ error: `Enter ${what}.` })
      .refine(Number.isFinite, `Enter ${what}.`)
      .refine((v) => v > 0, `Must be more than zero.`)
      .refine((v) => v <= max, `At most ${max.toLocaleString("en-GB")}.`)
      .transform((v) => Number(v.toFixed(decimals))),
  );

const count = (what: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\s/g, "") || undefined : value),
    z.coerce
      .number({ error: `Enter ${what}.` })
      .int("Use a whole number.")
      .min(1, `Enter ${what}.`)
      .max(max, `At most ${max.toLocaleString("en-GB")}.`),
  );

const country = (message: string) => z.string().refine((v) => isIsoCountry(v) && v !== "EU", message);

const PLATE = /^[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/;
const plate = z
  .string()
  .transform((v) => collapse(v).toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "Enter the registration number.")
      .regex(PLATE, "Letters and digits, with single spaces or dashes, e.g. 34 ABC 123.")
      .min(2, "That registration is too short.")
      .max(15, "At most 15 characters."),
  );

const optionalPlate = z
  .string()
  .transform((v) => collapse(v).toUpperCase())
  .pipe(z.union([z.literal(""), plate]))
  .transform((v) => v || null);

const STRICT_TAX_ID = /^[A-Z0-9]+(?:[ ./-][A-Z0-9]+)*$/;
const optionalTaxId = z
  .string()
  .transform((v) => collapse(v).toUpperCase())
  .refine(
    (v) => v === "" || (STRICT_TAX_ID.test(v) && TAX_ID_PATTERN.test(v)),
    "Letters and digits, with single spaces, dots, slashes or dashes between them.",
  )
  .transform((v) => v || null);

const DAY_MS = 86_400_000;

/** YYYY-MM-DD, a real date, within the window the database allows (−30 to +90 days). */
const takingOverDate = z.string().superRefine((value, ctx) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    ctx.addIssue({ code: "custom", message: "Choose the date the carrier collects the goods." });
    return;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    ctx.addIssue({ code: "custom", message: "That date doesn't exist." });
    return;
  }
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const offset = (date.getTime() - today) / DAY_MS;
  if (offset < -30) ctx.addIssue({ code: "custom", message: "Use a date within the last 30 days." });
  if (offset > 90) ctx.addIssue({ code: "custom", message: "Use a date within the next 90 days." });
});

const destinationCodes = DESTINATIONS.map(({ code }) => code) as [CountryCode, ...CountryCode[]];
const packageTypeCodes = PACKAGE_TYPES.map(({ code }) => code) as [PackageType, ...PackageType[]];
const adrClassCodes = ADR_CLASSES.map(({ code }) => code) as [AdrClass, ...AdrClass[]];

const CHOOSE_ITEM = "Choose the item this package carries.";

const lineSchema = z.object({
  description: z
    .string()
    .transform(collapse)
    .pipe(
      z
        .string()
        .min(1, "Enter a description of the goods.")
        .refine(isCleanText, SYMBOLS_MESSAGE)
        .max(MAX_DESCRIPTION_LENGTH, `Use at most ${MAX_DESCRIPTION_LENGTH} characters.`),
    ),
  unitPrice: amount("the unit price", 2, 1_000_000_000),
  originCountry: country("Choose the country where the goods were made."),
});

const packageSchema = z
  .object({
    line: z.coerce.number({ error: CHOOSE_ITEM }).int(CHOOSE_ITEM).min(1, CHOOSE_ITEM),
    packageType: z.enum(packageTypeCodes, { error: "Choose a package type." }),
    marks: z
      .string()
      .transform((v) => collapse(v).toUpperCase())
      .pipe(
        z
          .string()
          .min(1, "Enter the marks on the label.")
          .refine(isCleanText, SYMBOLS_MESSAGE)
          .max(60, "At most 60 characters."),
      ),
    quantity: count("the quantity", 1_000_000),
    netWeightKg: amount("the net weight", 3, MAX_PAYLOAD_KG),
    grossWeightKg: amount("the gross weight", 3, MAX_PAYLOAD_KG),
    lengthCm: count("the length", PACKAGE_LIMITS_CM.lengthCm),
    widthCm: count("the width", PACKAGE_LIMITS_CM.widthCm),
    heightCm: count("the height", PACKAGE_LIMITS_CM.heightCm),
  })
  .refine((p) => p.netWeightKg <= p.grossWeightKg, {
    path: ["netWeightKg"],
    message: "Net can't exceed gross.",
    // Checked as soon as both weights are valid, even while other fields of
    // the package are still empty, so the form can flag it on blur.
    when: ({ value }) => {
      const p = value as { netWeightKg?: unknown; grossWeightKg?: unknown };
      return typeof p.netWeightKg === "number" && typeof p.grossWeightKg === "number";
    },
  });

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round2 = (v: number) => Math.round(v * 100) / 100;

export const shipmentInputSchema = z
  .object({
    lines: z
      .array(lineSchema)
      .min(1, "Add at least one item.")
      .max(MAX_LINES, `At most ${MAX_LINES} items per shipment.`),
    currency: z.enum(CURRENCIES, { error: "Choose a currency." }),
    country: z.enum(destinationCodes, { error: "Choose a supported destination country." }),
    incoterm: z.enum(INCOTERMS.map(({ code }) => code) as [Incoterm, ...Incoterm[]], {
      error: "Choose an Incoterm.",
    }),
    incotermPlace: text("the named place", 120),
    deliveryPlace: text("the place of delivery", 200),
    consigneeName: text("the consignee's name", 200),
    consigneeAddress: lines("the consignee's address", 400),
    consigneeTaxId: optionalTaxId,
    carrierName: text("the carrier's name", 200),
    carrierAddress: lines("the carrier's address", 400),
    carrierCountry: country("Choose the carrier's country."),
    vehicleRegistration: plate,
    trailerRegistration: optionalPlate,
    takingOverPlace: text("the place of loading", 200),
    takingOverDate,
    senderInstructions: optionalLines(500),
    dangerous: z.enum(["yes", "no"]),
    unNumber: z.string(),
    shippingName: z.string().transform((v) => collapse(v).toUpperCase()),
    hazardClass: z.string(),
    packingGroup: z.string(),
    tunnelCode: z.string(),
    packages: z
      .array(packageSchema)
      .min(1, "Add at least one package.")
      .max(MAX_PACKAGES, `At most ${MAX_PACKAGES} packages per shipment.`),
  })
  .superRefine((v, ctx) => {
    if (v.dangerous === "yes") {
      if (!/^\d{4}$/.test(v.unNumber) || v.unNumber === "0000") {
        ctx.addIssue({ code: "custom", path: ["unNumber"], message: "Enter the 4-digit UN number, e.g. 1263." });
      }
      if (!v.shippingName) {
        ctx.addIssue({ code: "custom", path: ["shippingName"], message: "Enter the proper shipping name from ADR Table A." });
      } else if (!isCleanText(v.shippingName) || v.shippingName.length > 200) {
        ctx.addIssue({ code: "custom", path: ["shippingName"], message: SYMBOLS_MESSAGE });
      }
      if (!(adrClassCodes as string[]).includes(v.hazardClass)) {
        ctx.addIssue({ code: "custom", path: ["hazardClass"], message: "Choose the ADR class." });
      }
      if (v.packingGroup && !(PACKING_GROUPS as readonly string[]).includes(v.packingGroup)) {
        ctx.addIssue({ code: "custom", path: ["packingGroup"], message: "Choose I, II or III." });
      }
      if (v.tunnelCode && !(TUNNEL_CODES as readonly string[]).includes(v.tunnelCode)) {
        ctx.addIssue({ code: "custom", path: ["tunnelCode"], message: "Choose a tunnel restriction code." });
      }
    }

    // Each package carries one item's goods, and each item travels in at least one package.
    v.packages.forEach((p, i) => {
      if (p.line > v.lines.length) ctx.addIssue({ code: "custom", path: ["packages", i, "line"], message: CHOOSE_ITEM });
    });
    v.lines.forEach((_, i) => {
      if (!v.packages.some((p) => p.line === i + 1)) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i],
          message: `No package carries item ${i + 1}. Choose it on a package below, or remove the item.`,
        });
      }
    });

    // Every package must be identifiable at inspection.
    const seen = new Map<string, number>();
    v.packages.forEach((p, i) => {
      const first = seen.get(p.marks);
      if (first !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["packages", i, "marks"],
          message: `Same marks as package ${first + 1}. Give each package its own, e.g. ${p.marks}-${i + 1}.`,
        });
      } else {
        seen.set(p.marks, i);
      }
    });

    const gross = v.packages.reduce((sum, p) => sum + p.grossWeightKg, 0);
    const volume = v.packages.reduce((sum, p) => sum + (p.lengthCm * p.widthCm * p.heightCm) / 1_000_000, 0);
    if (gross > MAX_PAYLOAD_KG) {
      ctx.addIssue({
        code: "custom",
        path: ["packages"],
        message: `${round3(gross).toLocaleString("en-GB")} kg is more than one truck carries (${MAX_PAYLOAD_KG.toLocaleString("en-GB")} kg). Split it into separate shipments: one CMR per vehicle.`,
      });
    }
    if (volume > MAX_PAYLOAD_M3) {
      ctx.addIssue({
        code: "custom",
        path: ["packages"],
        message: `${volume.toFixed(1)} m³ is more than one truck holds (${MAX_PAYLOAD_M3} m³). Check the dimensions are in centimetres, or split the shipment.`,
      });
    }
  })
  .transform((v) => {
    const dangerousGoods: DangerousGoods | null =
      v.dangerous === "yes"
        ? {
            unNumber: v.unNumber,
            shippingName: v.shippingName,
            hazardClass: v.hazardClass as AdrClass,
            packingGroup: (v.packingGroup || null) as DangerousGoods["packingGroup"],
            tunnelCode: (v.tunnelCode || null) as DangerousGoods["tunnelCode"],
          }
        : null;

    // Each line's quantity and weights are its packages' sums, as the database computes them.
    const lines = v.lines.map((line, i) => {
      const own = v.packages.filter((p) => p.line === i + 1);
      return {
        ...line,
        quantity: own.reduce((sum, p) => sum + p.quantity, 0),
        netWeightKg: round3(own.reduce((sum, p) => sum + p.netWeightKg, 0)),
        grossWeightKg: round3(own.reduce((sum, p) => sum + p.grossWeightKg, 0)),
      };
    });

    return {
      lines,
      currency: v.currency,
      country: v.country,
      incoterm: v.incoterm,
      incotermPlace: v.incotermPlace,
      deliveryPlace: v.deliveryPlace,
      consignee: { name: v.consigneeName, address: v.consigneeAddress, taxId: v.consigneeTaxId },
      transport: {
        carrierName: v.carrierName,
        carrierAddress: v.carrierAddress,
        carrierCountry: v.carrierCountry,
        vehicleRegistration: v.vehicleRegistration,
        trailerRegistration: v.trailerRegistration,
        takingOverPlace: v.takingOverPlace,
        takingOverDate: v.takingOverDate,
        senderInstructions: v.senderInstructions,
      },
      dangerousGoods,
      packages: v.packages,
      // Shown in the form; the database recomputes them from the packages.
      totals: {
        packageCount: v.packages.length,
        quantity: v.packages.reduce((sum, p) => sum + p.quantity, 0),
        netWeightKg: round3(v.packages.reduce((sum, p) => sum + p.netWeightKg, 0)),
        grossWeightKg: round3(v.packages.reduce((sum, p) => sum + p.grossWeightKg, 0)),
        value: round2(lines.reduce((sum, line) => sum + round2(line.quantity * line.unitPrice), 0)),
      },
    };
  });

export type ShipmentInput = z.output<typeof shipmentInputSchema>;

/**
 * The CMR Convention covers carriage between two countries only (Art. 1), so
 * the destination can't be the exporter's own country. Checked apart from the
 * schema, which doesn't know the exporter.
 */
export function domesticShipmentError(destination: string, exporterCountry: string | null): string | null {
  return exporterCountry && destination === exporterCountry
    ? "Choose a country other than your own. Bordr's documents are for cross-border shipments."
    : null;
}

/** Every message per dotted path, the shape the form renders. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}
