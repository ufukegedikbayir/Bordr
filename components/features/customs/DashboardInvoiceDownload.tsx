"use client";

import { useRef, useState } from "react";
import { CircleAlert, Download } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { getShipmentInvoice } from "@/services/shipments/actions";
import type { ShipmentRow } from "@/services/shipments/queries";

import { loadInvoiceLogo } from "./invoice-logo";

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

type Status = "idle" | "pending" | "error";

/** Builds a past shipment's invoice in the browser on click and downloads it. */
export function DashboardInvoiceDownload({
  shipment,
  logoUrl,
}: {
  shipment: ShipmentRow;
  logoUrl: string | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  // A ref, not state, so a double click can't start two renders before re-render.
  const inFlight = useRef(false);

  // Earlier shipments lack the parties, values and weights an invoice needs.
  const invoiceNumber = shipment.invoice_number;
  if (!invoiceNumber) {
    return (
      <span
        title="Created before invoices carried full legal details. Generate it again to get an invoice."
        className="inline-grid size-8 place-items-center text-hairline-strong"
      >
        <Download aria-hidden className="size-4" />
        <span className="sr-only">No invoice: created before invoices carried full legal details</span>
      </span>
    );
  }

  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("pending");

    try {
      // The invoice is rebuilt from the saved record, so a re-download matches
      // the original exactly (number, date, parties, values).
      const [[{ pdf }, { CommercialInvoice }], logo, invoice] = await Promise.all([
        loadPdf(),
        loadInvoiceLogo(logoUrl),
        getShipmentInvoice(shipment.id),
      ]);
      if (!invoice) throw new Error(`No invoice data for shipment ${shipment.id}`);

      const blob = await pdf(<CommercialInvoice invoice={invoice} logoUrl={logo} />).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
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
        : `Download commercial invoice ${invoiceNumber}`;

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
