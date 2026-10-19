"use server";

import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

import {
  COUNTRIES,
  MAX_DESCRIPTION_LENGTH,
  type CustomsActionResult,
} from "./constants";

// Google's newest Flash models are volatile under load (503s, stalls) and the
// free tier rate-limits per model (429), so a second model is the retry and
// each attempt gets a short timeout instead of SDK retries. Default thinking on
// gemini-3.6-flash ranged from 4 s to a stall; minimal thinking answers in
// ~1.5 s. Re-check these when models change.
const MODELS = ["gemini-3.6-flash", "gemini-3.1-flash-lite"] as const;
const REQUEST_TIMEOUT_MS = 12_000;
const AI_UNAVAILABLE = "The AI service is unavailable right now. Try again in a moment.";

const SYSTEM_PROMPT =
  "Expert customs broker classifying products. Return exact JSON. Keep description under 6 words.";

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
 * Classifies a product with Gemini, saves it to the user's shipment history
 * and returns the customs data for the UI.
 *
 * Returns errors instead of throwing: Next.js redacts thrown Server Action
 * messages in production, and these are meant for the user.
 */
export async function generateCustomsData(
  description: string,
  country: string,
): Promise<CustomsActionResult> {
  // Server Actions are public endpoints: never spend AI quota on a signed-out caller.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to generate customs data." };

  const text = String(description).trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, error: "Describe your product to generate customs data." };
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, error: `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.` };
  }

  const destination = COUNTRIES.find(({ code }) => code === country);
  if (!destination) return { ok: false, error: "Choose a supported destination country." };

  const prompt = `Product: ${JSON.stringify(text)}
Destination country: ${destination.name}
Give the most accurate 6-digit HS code, the HS category name (at most 6 words), a realistic import duty percentage for this destination, and the customs documents strictly required (e.g. Commercial Invoice, CN22, Certificate of Origin).`;

  for (const modelId of MODELS) {
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

      const data = {
        hsCode,
        hsDescription: normalizeHsDescription(output.hsDescription) || "Description unavailable",
        estimatedDuty,
        requiredDocuments,
        country: destination.code,
      };

      // Persist before returning. A failed save still returns the result (the
      // AI quota is already spent) and tells the UI it isn't in the history.
      const { error: insertError } = await supabase.from("shipments").insert({
        user_id: user.id,
        description: text,
        country: data.country,
        hs_code: data.hsCode,
        hs_description: data.hsDescription,
        estimated_duty: data.estimatedDuty,
        documents: data.requiredDocuments,
      });
      if (insertError) {
        console.error("[generateCustomsData] saving shipment failed:", insertError.code, insertError.message);
      }

      return { ok: true, data, saved: !insertError };
    } catch (error) {
      console.error(`[generateCustomsData] ${modelId} failed:`, describeError(error));
    }
  }

  return { ok: false, error: AI_UNAVAILABLE };
}
