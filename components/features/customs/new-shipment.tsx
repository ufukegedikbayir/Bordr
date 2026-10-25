"use client";

import { useRef, useState } from "react";
import { z } from "zod";

import { generateCustomsData } from "@/services/customs/actions";
import { COUNTRIES, type CountryCode } from "@/services/customs/constants";
import { shipmentInputSchema, type ShipmentFormValues } from "@/services/customs/invoice";
import type { Workspace } from "@/services/workspaces/queries";

import { CustomsResults, type Outcome } from "./customs-results";
import { preloadInvoice } from "./InvoiceDownload";
import { loadInvoiceLogo } from "./invoice-logo";
import { ShipmentForm, fieldId, type FieldErrors, type FieldKey } from "./shipment-form";

const UNEXPECTED_ERROR = "Something went wrong while analyzing your product. Try again.";

// In form order. Origin and Incoterm start blank on purpose: they're
// declarations the exporter must make, not defaults to click past.
const INITIAL_VALUES: ShipmentFormValues = {
  description: "",
  quantity: "",
  unitPrice: "",
  currency: "EUR",
  originCountry: "",
  country: COUNTRIES[0].code,
  incoterm: "",
  incotermPlace: "",
  packageCount: "",
  grossWeightKg: "",
  netWeightKg: "",
  consigneeName: "",
  consigneeAddress: "",
  consigneeTaxId: "",
};

const FIELD_ORDER = Object.keys(INITIAL_VALUES) as FieldKey[];

/** Focus lands on the first problem a reader would meet. */
function focusFirstError(errors: FieldErrors) {
  const first = FIELD_ORDER.find((key) => errors[key]?.length);
  if (first) document.getElementById(fieldId(first))?.focus();
}

function sameValues(a: ShipmentFormValues, b: ShipmentFormValues) {
  return FIELD_ORDER.every((key) => a[key].trim() === b[key].trim());
}

/** Rendered only once the page has confirmed the workspace can issue invoices. */
export function NewShipment({ workspace }: { workspace: Workspace }) {
  const [values, setValues] = useState<ShipmentFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pending = outcome.status === "pending";
  const stale = outcome.status === "success" && !sameValues(outcome.submitted, values);

  function updateField(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit() {
    if (pending) return;

    // Same schema the server enforces, for instant field-level feedback.
    const parsed = shipmentInputSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = z.flattenError(parsed.error).fieldErrors;
      setErrors(fieldErrors);
      focusFirstError(fieldErrors);
      return;
    }

    const submitted = values;
    setErrors({});
    setOutcome({ status: "pending", country: submitted.country as CountryCode });
    // Warm the PDF chunk while the AI runs, so the download is ready with the result.
    preloadInvoice();

    try {
      // The logo loads alongside the AI call, so it adds no wait.
      const [result, logo] = await Promise.all([
        generateCustomsData(submitted, workspace.id),
        loadInvoiceLogo(workspace.logoUrl),
      ]);

      if (result.ok) {
        setOutcome({ status: "success", data: result.data, invoice: result.invoice, logo, submitted });
        return;
      }
      if (result.reason === "invalid" && result.fieldErrors) {
        setErrors(result.fieldErrors as FieldErrors);
        focusFirstError(result.fieldErrors as FieldErrors);
      }
      setOutcome({ status: "error", message: result.error, settingsLink: result.reason === "profile_incomplete" });
    } catch {
      setOutcome({ status: "error", message: UNEXPECTED_ERROR });
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <ShipmentForm
        values={values}
        errors={errors}
        pending={pending}
        textareaRef={textareaRef}
        onChange={updateField}
        onSubmit={handleSubmit}
      />
      <CustomsResults outcome={outcome} stale={stale} />
    </div>
  );
}
