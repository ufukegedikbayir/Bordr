// Builds one freight document in the browser on demand. The renderer and each
// template load in their own chunks on first use, so pages that list
// documents ship no PDF code until someone downloads one.
import { documentNumber } from "@/services/customs/freight";
import type { DocumentKind, ShipmentDocuments } from "@/services/customs/documents";

const renderer = () => import("@react-pdf/renderer");

const templates = {
  invoice: () => import("./CommercialInvoice"),
  "packing-list": () => import("./PackingList"),
  cmr: () => import("./CMRDocument"),
  "certificate-of-origin": () => import("./CertificateOfOrigin"),
} satisfies Record<DocumentKind, () => Promise<unknown>>;

/** Warm the renderer (e.g. while the AI call runs). Failure is harmless. */
export function preloadDocuments() {
  void renderer().catch(() => {});
}

export function preloadDocument(kind: DocumentKind) {
  void Promise.all([renderer(), templates[kind]()]).catch(() => {});
}

export function documentFileName(kind: DocumentKind, invoiceNumber: string) {
  const number =
    kind === "invoice"
      ? invoiceNumber
      : documentNumber(invoiceNumber, kind === "packing-list" ? "PL" : kind === "cmr" ? "CMR" : "COO");
  return `${number}.pdf`;
}

async function element(kind: DocumentKind, docs: ShipmentDocuments, logo: string | null) {
  switch (kind) {
    case "invoice": {
      const { CommercialInvoice } = await templates.invoice();
      return <CommercialInvoice invoice={docs.invoice} logoUrl={logo} />;
    }
    case "packing-list": {
      const { PackingList } = await templates["packing-list"]();
      return <PackingList data={docs} logoUrl={logo} />;
    }
    case "cmr": {
      const { transport } = docs;
      if (!transport) throw new Error("This shipment has no transport details for a CMR.");
      const { CMRDocument } = await templates.cmr();
      return <CMRDocument data={{ ...docs, transport }} />;
    }
    case "certificate-of-origin": {
      const { CertificateOfOrigin } = await templates["certificate-of-origin"]();
      return <CertificateOfOrigin data={docs} />;
    }
  }
}

// Long enough for every browser to start the download before the URL dies.
const REVOKE_DELAY_MS = 10_000;

/** Renders the document and hands it to the browser as a download. */
export async function downloadDocument(kind: DocumentKind, docs: ShipmentDocuments, logo: string | null) {
  const [{ pdf }, doc] = await Promise.all([renderer(), element(kind, docs, logo)]);
  const blob = await pdf(doc).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = documentFileName(kind, docs.invoice.invoiceNumber);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
