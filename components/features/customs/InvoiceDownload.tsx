"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { CircleAlert, Download } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import type { CustomsResult } from "@/services/customs/constants";

export const INVOICE_FILE_NAME = "commercial_invoice.pdf";

const BUTTON =
  "inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium sm:w-auto";

type InvoiceDownloadProps = { description: string; result: CustomsResult; logo: string | null };

function Preparing() {
  return (
    <span
      role="status"
      className={cn(BUTTON, "cursor-wait border border-hairline-strong bg-surface text-ink-muted")}
    >
      <Spinner />
      Preparing PDF…
    </span>
  );
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// @react-pdf/renderer is browser-only at render time and heavy, so it and the
// template load in their own chunk, on the client only, once there is a result.
const loadPdf = () =>
  Promise.all([import("@react-pdf/renderer"), import("./CommercialInvoice")]);

/** Warm the PDF chunk (e.g. while the AI call runs). Failure is harmless. */
export function preloadInvoice() {
  void loadPdf().catch(() => {});
}

const InvoiceLink = dynamic(
  async () => {
    const [{ PDFDownloadLink }, { CommercialInvoice }] = await loadPdf();

    return function InvoiceLink({ description, result, logo }: InvoiceDownloadProps) {
      // PDFDownloadLink re-renders the PDF whenever `document` changes identity,
      // so the element (and its issue date) must be stable between renders.
      const invoice = useMemo(
        () => (
          <CommercialInvoice
            description={description}
            country={result.country}
            hsCode={result.hsCode}
            hsDescription={result.hsDescription}
            estimatedDuty={result.estimatedDuty}
            issuedAt={new Date()}
            logoUrl={logo}
          />
        ),
        [description, result, logo],
      );

      return (
        <PDFDownloadLink
          document={invoice}
          fileName={INVOICE_FILE_NAME}
          className="flex w-full shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ground sm:inline-flex sm:w-auto"
        >
          {({ blob, loading, error }) => {
            if (error) {
              return (
                <span
                  role="alert"
                  className={cn(BUTTON, "border border-danger-border bg-danger-surface text-danger")}
                >
                  <CircleAlert aria-hidden className="size-4" />
                  Couldn&apos;t prepare PDF
                </span>
              );
            }

            if (loading || !blob) return <Preparing />;

            return (
              <span
                aria-label={`Download ${INVOICE_FILE_NAME}`}
                className={cn(
                  BUTTON,
                  "cursor-pointer bg-accent text-accent-ink shadow-[0_1px_1px_oklch(0.21_0.02_255/0.12)] transition-colors duration-150 hover:bg-accent-hover",
                )}
              >
                <Download aria-hidden className="size-4" />
                Download invoice
                <span className="text-xs font-normal tabular-nums opacity-75">
                  {formatSize(blob.size)}
                </span>
              </span>
            );
          }}
        </PDFDownloadLink>
      );
    };
  },
  { ssr: false, loading: Preparing },
);

export function InvoiceDownload(props: InvoiceDownloadProps) {
  return <InvoiceLink {...props} />;
}
