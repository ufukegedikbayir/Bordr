"use client";

import { useRef, useState } from "react";

import { generateCustomsData } from "@/services/customs/actions";
import type { Workspace } from "@/services/workspaces/queries";
import { COUNTRIES, type CountryCode } from "@/services/customs/constants";

import { CustomsResults, type Outcome } from "./customs-results";
import { preloadInvoice } from "./InvoiceDownload";
import { loadInvoiceLogo } from "./invoice-logo";
import { ShipmentForm } from "./shipment-form";

const UNEXPECTED_ERROR = "Something went wrong while analyzing your product. Try again.";
const NO_WORKSPACE = "Your workspace couldn't be loaded. Reload the page and try again.";

export function NewShipment({ activeWorkspace }: { activeWorkspace: Promise<Workspace | null> }) {
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState<CountryCode>(COUNTRIES[0].code);
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pending = outcome.status === "pending";
  const stale =
    outcome.status === "success" &&
    (outcome.description !== description.trim() || outcome.data.country !== country);

  function updateDescription(value: string) {
    setDescription(value);
    if (fieldError) setFieldError(null);
  }

  async function handleSubmit() {
    if (pending) return;

    const trimmed = description.trim();
    if (!trimmed) {
      setFieldError("Describe your product to generate customs data.");
      textareaRef.current?.focus();
      return;
    }

    setFieldError(null);
    setOutcome({ status: "pending", country });
    // Warm the PDF chunk while the AI runs, so the download is ready with the result.
    preloadInvoice();

    try {
      const workspace = await activeWorkspace;
      // The logo loads alongside the AI call, so it adds no wait.
      const [result, logo] = workspace
        ? await Promise.all([
            generateCustomsData(trimmed, country, workspace.id),
            loadInvoiceLogo(workspace.logoUrl),
          ])
        : [{ ok: false, error: NO_WORKSPACE } as const, null];
      setOutcome(
        result.ok
          ? { status: "success", data: result.data, description: trimmed, saved: result.saved, logo }
          : { status: "error", message: result.error },
      );
    } catch {
      setOutcome({ status: "error", message: UNEXPECTED_ERROR });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-[-0.015em] sm:text-2xl">New shipment</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">
          Classify your product, estimate import duty and get the customs paperwork for a
          cross-border order.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <ShipmentForm
          description={description}
          country={country}
          pending={pending}
          error={fieldError}
          textareaRef={textareaRef}
          onDescriptionChange={updateDescription}
          onCountryChange={setCountry}
          onSubmit={handleSubmit}
        />
        <CustomsResults outcome={outcome} stale={stale} />
      </div>
    </div>
  );
}
