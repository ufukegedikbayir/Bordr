"use client";

import { useRef, useState } from "react";
import { CircleAlert, Download, FileText } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { DOCUMENT_KINDS, availableDocuments, type DocumentKind, type ShipmentDocuments } from "@/services/customs/documents";

import { documentFileName, downloadDocument, preloadDocument } from "./pdf/build";

const NOTES: Record<DocumentKind, string> = {
  invoice: "Signed by you as the exporter.",
  "packing-list": "Package by package, for inspection.",
  cmr: "Three originals, signed by you and the carrier.",
  "certificate-of-origin": "Submit to your chamber of commerce to certify.",
};

function DocumentRow({ kind, docs, logo }: { kind: DocumentKind; docs: ShipmentDocuments; logo: string | null }) {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const inFlight = useRef(false);
  const { name } = DOCUMENT_KINDS.find((d) => d.kind === kind)!;
  const fileName = documentFileName(kind, docs.invoice.invoiceNumber);

  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("pending");
    try {
      await downloadDocument(kind, docs, logo);
      setStatus("idle");
    } catch (error) {
      console.error(`[DocumentList] ${kind} failed:`, error);
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-hairline bg-surface text-ink-muted">
        <FileText aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {name} <span className="font-normal text-ink-muted tabular-nums">{fileName.replace(/\.pdf$/, "")}</span>
        </p>
        <p className={cn("truncate text-xs", status === "error" ? "text-danger" : "text-ink-muted")}>
          {status === "error" ? "Couldn't prepare the PDF. Try again." : NOTES[kind]}
        </p>
      </div>
      <button
        type="button"
        onClick={download}
        onPointerEnter={() => preloadDocument(kind)}
        onFocus={() => preloadDocument(kind)}
        aria-busy={status === "pending" || undefined}
        aria-label={`Download ${name} ${fileName}`}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium outline-none",
          "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ground",
          status === "error"
            ? "border-danger-border bg-danger-surface text-danger"
            : "border-hairline-strong bg-surface text-ink hover:bg-ground",
          status === "pending" && "cursor-wait",
        )}
      >
        {status === "pending" ? (
          <Spinner />
        ) : status === "error" ? (
          <CircleAlert aria-hidden className="size-3.5" />
        ) : (
          <Download aria-hidden className="size-3.5" />
        )}
        PDF
      </button>
    </li>
  );
}

/** Every document the saved shipment supports, each built on click. */
export function DocumentList({ documents, logo }: { documents: ShipmentDocuments; logo: string | null }) {
  return (
    <ul className="grid divide-y divide-hairline">
      {availableDocuments(documents).map((kind) => (
        <DocumentRow key={kind} kind={kind} docs={documents} logo={logo} />
      ))}
    </ul>
  );
}
