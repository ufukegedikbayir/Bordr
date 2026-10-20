"use client";

import { useRef, useState } from "react";
import { CircleAlert, Download } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { isCountryCode } from "@/services/customs/constants";
import type { ShipmentRow } from "@/services/shipments/queries";

// The renderer and template load in their own chunk on first use, so a table
// of 100 rows ships 100 small buttons and no PDF code.
const loadPdf = () =>
  Promise.all([import("@react-pdf/renderer"), import("./CommercialInvoice")]);

/** Warm the chunk when the pointer heads for a button. Failure is harmless. */
function preload() {
  void loadPdf().catch(() => {});
}

// Long enough for every browser to start the download before the URL dies.
const REVOKE_DELAY_MS = 10_000;

function fileName(shipment: ShipmentRow) {
  return `commercial_invoice_${shipment.created_at.slice(0, 10)}_${shipment.id.slice(0, 8)}.pdf`;
}

type Status = "idle" | "pending" | "error";

/** Builds a past shipment's invoice in the browser on click and downloads it. */
export function DashboardInvoiceDownload({ shipment }: { shipment: ShipmentRow }) {
  const [status, setStatus] = useState<Status>("idle");
  // A ref, not state, so a double click can't start two renders before re-render.
  const inFlight = useRef(false);

  if (!isCountryCode(shipment.country)) {
    return (
      <span
        title="Invoices aren't available for this destination"
        className="inline-grid size-8 place-items-center text-hairline-strong"
      >
        <Download aria-hidden className="size-4" />
        <span className="sr-only">Invoice unavailable for this destination</span>
      </span>
    );
  }

  // Narrowed above; captured as a const so the hoisted handler keeps the type.
  const country = shipment.country;

  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("pending");

    try {
      const [{ pdf }, { CommercialInvoice }] = await loadPdf();
      const blob = await pdf(
        <CommercialInvoice
          description={shipment.description}
          country={country}
          hsCode={shipment.hs_code}
          hsDescription={shipment.hs_description}
          estimatedDuty={shipment.estimated_duty}
          // A re-download reproduces the original document, so it keeps its date.
          issuedAt={new Date(shipment.created_at)}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(shipment);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
      setStatus("idle");
    } catch (error) {
      console.error("[DashboardInvoiceDownload] PDF generation failed:", error);
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  const label =
    status === "pending"
      ? "Preparing invoice…"
      : status === "error"
        ? "Couldn't prepare the invoice. Try again"
        : "Download commercial invoice";

  return (
    <button
      type="button"
      onClick={download}
      onPointerEnter={preload}
      onFocus={preload}
      aria-busy={status === "pending" || undefined}
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-8 place-items-center rounded-md outline-none",
        "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent",
        status === "error"
          ? "text-danger hover:bg-danger-surface"
          : "text-ink-muted hover:bg-surface hover:text-ink hover:ring-1 hover:ring-hairline",
        status === "pending" && "cursor-wait",
      )}
    >
      {status === "pending" ? (
        <Spinner />
      ) : status === "error" ? (
        <CircleAlert aria-hidden className="size-4" />
      ) : (
        <Download aria-hidden className="size-4" />
      )}
    </button>
  );
}
