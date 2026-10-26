"use server";

import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/services/workspaces/profile";
import { getCompanyProfile, isWorkspaceMember } from "@/services/workspaces/queries";

import { COUNTRIES, type CustomsActionResult } from "./constants";
import { DOCUMENT_COLUMNS, documentsFromRow, type DocumentRow } from "./documents";
import { adrDescription, packageTypeName } from "./freight";
import { INCOTERMS, regionName } from "./invoice";
import { createShipmentPayload } from "./payload";
import { fieldErrorsFrom, shipmentInputSchema, type ShipmentFormValues } from "./shipment-input";

// Google's newest Flash models are volatile under load (503s, stalls) and the
// free tier rate-limits per model (429), so a second model is the retry and
// each attempt gets a short timeout instead of SDK retries. Default thinking on
// gemini-3.6-flash ranged from 4 s to a stall; minimal thinking answers in
// ~1.5 s. Re-check these when models change.
const MODELS = ["gemini-3.6-flash", "gemini-3.1-flash-lite"] as const;
const REQUEST_TIMEOUT_MS = 12_000;
const AI_UNAVAILABLE = "The AI service is unavailable right now. Try again in a moment.";

// The AI classifies and reviews; it never supplies a declared fact. Parties,
// values, weights, origin and the Incoterm come from the user and the
// company profile, because the exporter signs the invoice as true.
const SYSTEM_PROMPT = `You are a senior customs broker and trade compliance officer for international road freight.
You receive facts an exporter has declared for one commercial invoice line. Treat them as given: never change, invent or restate them.
Your job:
1. Classify the goods: the most accurate 6-digit HS code and its category name (at most 6 words).
2. Estimate the destination's import duty for these goods from this origin, as a percentage of customs value.
3. List the documents customs and the carrier will strictly require for this shipment by road (e.g. Commercial Invoice, Packing List, CMR Consignment Note, Certificate of Origin, Export Declaration).
4. Give up to 3 short compliance notes (one sentence each) only where something needs the exporter's attention, most important first:
   - dangerous goods: the goods are likely dangerous goods under ADR but none are declared, or the declared UN number, class or packing group doesn't fit the goods;
   - a preferential origin proof that could reduce duty, licences or restrictions for this product;
   - an Incoterm that makes the exporter responsible for import duties and VAT;
   - declared weights, values or package sizes that look implausible for the goods.
   Return an empty list if nothing stands out.
Return exact JSON.`;

// The .describe() hints steer formatting; the normalizers below enforce it.
const customsSchema = z.object({
  hsCode: z.string().describe("6-digit HS code formatted as XXXX.XX"),
  hsDescription: z
    .string()
    .describe("Short name of the HS code category, at most 6 words, e.g. 'Leather pocket articles'"),
  estimatedDuty: z
    .string()
    .describe("Import duty as a percentage of customs value, e.g. 5.0%"),
  requiredDocuments: z
    .array(z.string())
    .describe("Names of the customs documents strictly required"),
  complianceNotes: z
    .array(z.string())
    .describe("Up to 3 one-sentence notes needing the exporter's attention; empty if none"),
});

/** "420231", "4202.31.60" or "HS 4202.31" -> "4202.31". Null if fewer than 6 digits. */
function normalizeHsCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 6 ? `${digits.slice(0, 4)}.${digits.slice(4, 6)}` : null;
}

/** Trimmed, sentence-cased, capped at 6 words. */
function normalizeHsDescription(raw: string): string {
  const words = raw.trim().replace(/[.\s]+$/, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const text = words.slice(0, 6).join(" ").slice(0, 80);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "5%", "Free (0%)" or "5 percent" -> "5.0%" / "0.0%". Null if no usable rate. */
function normalizeDuty(raw: string): string | null {
  if (/\b(duty[- ]?free|free|exempt)\b/i.test(raw) && !/\d/.test(raw)) return "0.0%";
  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const rate = Number.parseFloat(match[0]);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? `${rate.toFixed(1)}%` : null;
}

/** Trimmed, de-duplicated (case-insensitive), capped at 6. */
function normalizeDocuments(raw: string[]): string[] {
  const seen = new Set<string>();
  const documents: string[] = [];
  for (const item of raw) {
    const name = item.trim().replace(/\s+/g, " ").slice(0, 60);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    documents.push(name);
    if (documents.length === 6) break;
  }
  return documents;
}

/** Trimmed, de-duplicated, capped at 3 short sentences. */
function normalizeNotes(raw: string[]): string[] {
  const notes = raw.map((note) => note.trim().replace(/\s+/g, " ")).filter((note) => note.length > 0);
  return [...new Set(notes)].slice(0, 3).map((note) => (note.length > 240 ? `${note.slice(0, 239)}…` : note));
}

/** Safe-to-log summary of a failure: never the request body or credentials. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const status = (error as { statusCode?: number }).statusCode;
    const message = error.message.replace(/\s+/g, " ").slice(0, 200);
    return `${error.name}${status ? ` (HTTP ${status})` : ""}: ${message}`;
  }
  return "Unknown error";
}

/**
 * Classifies the declared goods with Gemini, saves the shipment with its full
 * invoice particulars to the active workspace and returns both for the UI.
 *
 * Returns errors instead of throwing: Next.js redacts thrown Server Action
 * messages in production, and these are meant for the user.
 */
export async function generateCustomsData(
  values: ShipmentFormValues,
  activeWorkspaceId: string,
): Promise<CustomsActionResult> {
  // Server Actions are public endpoints: never spend AI quota on a signed-out caller.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to generate customs data." };

  // The form validates with the same schema; this is the check that counts.
  const parsed = shipmentInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      error: "Some shipment details need fixing.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const input = parsed.data;
  const description = input.description.replace(/\s+/g, " ");
  const destination = COUNTRIES.find(({ code }) => code === input.country)!;

  // The client names the workspace; never trust it. Checked before the AI
  // call so a forged id costs no quota. RLS enforces the same rule on insert.
  const workspaceId = String(activeWorkspaceId);
  if (!(await isWorkspaceMember(supabase, user.id, workspaceId))) {
    return { ok: false, error: "You don't have access to this workspace. Reload the page and try again." };
  }

  // The database refuses the shipment without an exporter identity, so stop
  // here rather than after spending AI quota.
  const profile = await getCompanyProfile(workspaceId);
  if (!profile || !isProfileComplete(profile)) {
    return {
      ok: false,
      reason: "profile_incomplete",
      error: "Add your company details in Settings first. They appear as the exporter on every invoice.",
    };
  }

  const incoterm = INCOTERMS.find(({ code }) => code === input.incoterm)!;
  const { totals } = input;
  const total = totals.quantity * input.unitPrice;
  const prompt = `Declared facts (JSON):
${JSON.stringify(
  {
    goods: description,
    quantity: totals.quantity,
    unitPrice: `${input.unitPrice.toFixed(2)} ${input.currency}`,
    totalValue: `${total.toFixed(2)} ${input.currency}`,
    countryOfOrigin: `${regionName(input.originCountry)} (${input.originCountry})`,
    exporterCountry: `${regionName(profile.countryCode!)} (${profile.countryCode})`,
    destinationCountry: `${destination.name} (${destination.code})`,
    incoterm: `${incoterm.code} (${incoterm.name}) ${input.incotermPlace}`,
    packages: input.packages.map((p) => ({
      type: packageTypeName(p.packageType),
      pieces: p.quantity,
      netKg: p.netWeightKg,
      grossKg: p.grossWeightKg,
      dimensionsCm: `${p.lengthCm} x ${p.widthCm} x ${p.heightCm}`,
    })),
    totalGrossWeightKg: totals.grossWeightKg,
    totalNetWeightKg: totals.netWeightKg,
    dangerousGoods: input.dangerousGoods ? `ADR: ${adrDescription(input.dangerousGoods)}` : "None declared",
    transport: "Road",
  },
  null,
  2,
)}`;

  for (const modelId of MODELS) {
    let data;
    try {
      const { output } = await generateText({
        model: google(modelId),
        output: Output.object({ schema: customsSchema }),
        system: SYSTEM_PROMPT,
        prompt,
        temperature: 0,
        maxRetries: 0, // the fallback model is the retry
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        // HS lookup needs recall, not long reasoning; minimal thinking prevents stalls.
        providerOptions: {
          google: { thinkingConfig: { thinkingLevel: "minimal" } },
        },
      });

      const hsCode = normalizeHsCode(output.hsCode);
      const estimatedDuty = normalizeDuty(output.estimatedDuty);
      const requiredDocuments = normalizeDocuments(output.requiredDocuments);

      if (!hsCode || !estimatedDuty || requiredDocuments.length === 0) {
        throw new Error(
          `Unusable model output: hsCode=${JSON.stringify(output.hsCode)} estimatedDuty=${JSON.stringify(output.estimatedDuty)} documents=${requiredDocuments.length}`,
        );
      }

      data = {
        hsCode,
        hsDescription: normalizeHsDescription(output.hsDescription) || "Description unavailable",
        estimatedDuty,
        requiredDocuments,
        country: destination.code,
        complianceNotes: normalizeNotes(output.complianceNotes ?? []),
      };
    } catch (error) {
      console.error(`[generateCustomsData] ${modelId} failed:`, describeError(error));
      continue;
    }

    // Persist before returning, in one transaction: the shipment, its carrier
    // and its packages. The database computes the totals from the packages and
    // adds the exporter snapshot and the invoice number. A failed save still
    // returns the classification (the AI quota is spent) but no documents,
    // since they need the saved number.
    const { data: shipmentId, error: saveError } = await supabase.rpc(
      "create_shipment",
      createShipmentPayload(input, workspaceId, { ...data, description }),
    );

    if (saveError || typeof shipmentId !== "string") {
      console.error("[generateCustomsData] saving shipment failed:", saveError?.code, saveError?.message, saveError?.hint);
      return { ok: true, data, documents: null };
    }

    const { data: row, error: readError } = await supabase
      .from("shipments")
      .select(DOCUMENT_COLUMNS)
      .eq("id", shipmentId)
      .single();
    if (readError) console.error("[generateCustomsData] reading saved shipment failed:", readError.code, readError.message);

    return { ok: true, data, documents: row ? documentsFromRow(row as unknown as DocumentRow) : null };
  }

  return { ok: false, error: AI_UNAVAILABLE };
}
