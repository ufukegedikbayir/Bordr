"use client";

import { useEffect, useRef, useState } from "react";

import type { Carrier } from "@/services/carriers/queries";
import { generateCustomsData } from "@/services/customs/actions";
import { COUNTRIES, type CountryCode } from "@/services/customs/constants";
import { regionName } from "@/services/customs/invoice";
import {
  EMPTY_PACKAGE,
  fieldErrorsFrom,
  nextMarks,
  shipmentInputSchema,
  type FieldErrors,
  type PackageField,
  type PackageFormValues,
  type ScalarField,
  type ShipmentFormValues,
} from "@/services/customs/shipment-input";
import type { Workspace } from "@/services/workspaces/queries";

import { CustomsResults, type Outcome } from "./customs-results";
import { loadInvoiceLogo } from "./invoice-logo";
import { preloadDocuments } from "./pdf/build";
import { ShipmentForm } from "./shipment-form";

const UNEXPECTED_ERROR = "Something went wrong while analyzing your product. Try again.";

/** Under these rules the named place is at origin: where the carrier loads. */
const ORIGIN_TERMS = new Set(["EXW", "FCA"]);

// UTC, so the server render and the browser agree on the default. Just after
// midnight east of UTC it shows yesterday; the field stays editable.
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function initialValues(loadingPlace: string): ShipmentFormValues {
  // Origin and Incoterm start blank on purpose: they're declarations the
  // exporter must make, not defaults to click past.
  return {
    description: "",
    unitPrice: "",
    currency: "EUR",
    originCountry: "",
    country: COUNTRIES[0].code,
    incoterm: "",
    incotermPlace: "",
    deliveryPlace: "",
    consigneeName: "",
    consigneeAddress: "",
    consigneeTaxId: "",
    carrierName: "",
    carrierAddress: "",
    carrierCountry: "",
    vehicleRegistration: "",
    trailerRegistration: "",
    takingOverPlace: loadingPlace,
    takingOverDate: todayUtc(),
    senderInstructions: "",
    dangerous: "no",
    unNumber: "",
    shippingName: "",
    hazardClass: "",
    packingGroup: "",
    tunnelCode: "",
    packages: [{ ...EMPTY_PACKAGE, marks: "1" }],
  };
}

const sameValues = (a: ShipmentFormValues, b: ShipmentFormValues) => JSON.stringify(a) === JSON.stringify(b);

/** Marks no other package uses, counting up from `marks`. */
function uniqueMarks(marks: string, packages: PackageFormValues[]) {
  const taken = new Set(packages.map((p) => p.marks.trim().toUpperCase()));
  let candidate = nextMarks(marks);
  for (let i = 0; i < 200 && taken.has(candidate.toUpperCase()); i++) candidate = nextMarks(candidate);
  return candidate;
}

/** Rendered only once the page has confirmed the workspace can issue documents. */
export function NewShipment({
  workspace,
  carriers,
  origin,
}: {
  workspace: Workspace;
  carriers: Carrier[];
  /** The exporter's city and country, the default place of loading. */
  origin: { city: string | null; countryCode: string | null };
}) {
  const defaultLoadingPlace =
    origin.city && origin.countryCode ? `${origin.city}, ${regionName(origin.countryCode)}` : "";
  const [values, setValues] = useState<ShipmentFormValues>(() => initialValues(defaultLoadingPlace));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  const [focusRequest, setFocusRequest] = useState(0);
  // Places the user typed themselves; the rest follow the Incoterm.
  const edited = useRef(new Set<ScalarField>());
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pending = outcome.status === "pending";
  const stale = outcome.status === "success" && !sameValues(outcome.submitted, values);

  // After errors render, move focus to the first one a reader would meet.
  useEffect(() => {
    if (!focusRequest) return;
    const container = containerRef.current;
    const target =
      container?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      container?.querySelector<HTMLElement>("#shipment-packages-error");
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusRequest]);

  function clearErrors(match: (path: string) => boolean) {
    setErrors((current) => {
      const keys = Object.keys(current).filter(match);
      if (!keys.length) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function updateField(key: ScalarField, value: string) {
    if (key === "deliveryPlace" || key === "takingOverPlace") edited.current.add(key);

    setValues((current) => {
      const next = { ...current, [key]: value } as ShipmentFormValues;

      // The named place usually *is* the place of loading (EXW, FCA) or of
      // delivery (every other rule), until the user says otherwise.
      if (key === "incoterm" || key === "incotermPlace") {
        const atOrigin = ORIGIN_TERMS.has(next.incoterm);
        if (atOrigin && !edited.current.has("takingOverPlace")) {
          next.takingOverPlace = next.incotermPlace || defaultLoadingPlace;
        }
        if (!atOrigin && next.incoterm && !edited.current.has("deliveryPlace")) {
          next.deliveryPlace = next.incotermPlace;
        }
      }
      return next;
    });

    clearErrors((path) => path === key || (key === "dangerous" && ["unNumber", "shippingName", "hazardClass", "packingGroup", "tunnelCode"].includes(path)));
  }

  function pickCarrier(carrier: Carrier) {
    setValues((current) => ({
      ...current,
      carrierName: carrier.name,
      carrierAddress: carrier.address,
      carrierCountry: carrier.countryCode,
    }));
    clearErrors((path) => path.startsWith("carrier"));
  }

  const packageHandlers = {
    onChange(index: number, field: PackageField, value: string) {
      setValues((current) => ({
        ...current,
        packages: current.packages.map((p, i) => {
          if (i !== index) return p;
          const next = { ...p, [field]: value };
          // A EUR pallet is always 120 × 80.
          if (field === "packageType" && value === "eur_pallet") {
            next.lengthCm ||= "120";
            next.widthCm ||= "80";
          }
          return next;
        }),
      }));
      clearErrors((path) => path === `packages.${index}.${field}` || path === "packages");
    },
    onAdd() {
      setValues((current) => {
        const last = current.packages.at(-1);
        const added: PackageFormValues = last
          ? { ...EMPTY_PACKAGE, packageType: last.packageType, lengthCm: last.lengthCm, widthCm: last.widthCm, marks: uniqueMarks(last.marks, current.packages) }
          : { ...EMPTY_PACKAGE, marks: "1" };
        return { ...current, packages: [...current.packages, added] };
      });
      clearErrors((path) => path === "packages");
    },
    onDuplicate(index: number) {
      setValues((current) => {
        const source = current.packages[index];
        if (!source) return current;
        // Appended, so duplicating the same package repeatedly counts up in order: 01, 02, 03.
        const copy = { ...source, marks: uniqueMarks(source.marks, current.packages) };
        return { ...current, packages: [...current.packages, copy] };
      });
      clearErrors((path) => path === "packages");
    },
    onRemove(index: number) {
      setValues((current) =>
        current.packages.length === 1 ? current : { ...current, packages: current.packages.filter((_, i) => i !== index) },
      );
      clearErrors((path) => path.startsWith("packages"));
    },
  };

  /**
   * On leaving a field, checks it against the full schema (cross-field rules
   * included, e.g. net above gross) and shows or clears just that field's error.
   */
  function validatePath(path: string) {
    const parsed = shipmentInputSchema.safeParse(values);
    const message = parsed.success ? undefined : fieldErrorsFrom(parsed.error)[path];
    // Only flag a field the user has filled: empty required fields wait for submit.
    const value = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], values);
    setErrors((current) => {
      if (message && value !== "") return { ...current, [path]: message };
      if (!current[path]) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    setFocusRequest((n) => n + 1);
  }

  async function handleSubmit() {
    if (pending) return;

    // Same schema the server enforces, for instant field-level feedback.
    const parsed = shipmentInputSchema.safeParse(values);
    if (!parsed.success) {
      showErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    const submitted = values;
    setErrors({});
    setOutcome({ status: "pending", country: submitted.country as CountryCode });
    // Warm the PDF renderer while the AI runs, so downloads are ready with the result.
    preloadDocuments();

    try {
      // The logo loads alongside the AI call, so it adds no wait.
      const [result, logo] = await Promise.all([
        generateCustomsData(submitted, workspace.id),
        loadInvoiceLogo(workspace.logoUrl),
      ]);

      if (result.ok) {
        setOutcome({ status: "success", data: result.data, documents: result.documents, logo, submitted });
        return;
      }
      if (result.reason === "invalid" && result.fieldErrors) showErrors(result.fieldErrors);
      setOutcome({ status: "error", message: result.error, settingsLink: result.reason === "profile_incomplete" });
    } catch {
      setOutcome({ status: "error", message: UNEXPECTED_ERROR });
    }
  }

  return (
    <div ref={containerRef} className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <ShipmentForm
        values={values}
        errors={errors}
        pending={pending}
        carriers={carriers}
        textareaRef={textareaRef}
        onChange={updateField}
        onPickCarrier={pickCarrier}
        onSubmit={handleSubmit}
        onBlurField={validatePath}
        packages={{ ...packageHandlers, onBlurField: validatePath }}
      />
      <div className="xl:sticky xl:top-6">
        <CustomsResults outcome={outcome} stale={stale} />
      </div>
    </div>
  );
}
