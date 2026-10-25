"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, CircleAlert, FileText } from "lucide-react";

import { loadInvoiceLogo } from "@/components/features/customs/invoice-logo";
import { documentFileName, downloadDocument, preloadDocuments } from "@/components/features/customs/pdf/build";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { DOCUMENT_KINDS, type DocumentKind, type ShipmentDocuments } from "@/services/customs/documents";
import { getShipmentDocuments } from "@/services/shipments/actions";
import type { ShipmentRow } from "@/services/shipments/queries";

// Matches the menu's w-64, so it can be placed before it renders.
const MENU_WIDTH_PX = 256;

/** What a history row has the particulars for, without fetching them. */
function kindsFor(shipment: ShipmentRow): DocumentKind[] {
  if (!shipment.invoice_number) return [];
  const kinds: DocumentKind[] = ["invoice"];
  if (shipment.package_rows > 0) kinds.push("packing-list", "certificate-of-origin");
  if (shipment.package_rows > 0 && shipment.vehicle_registration) kinds.push("cmr");
  return DOCUMENT_KINDS.map(({ kind }) => kind).filter((kind) => kinds.includes(kind));
}

/**
 * A row's document downloads. The menu is a native popover, so the table's
 * scroll container can't clip it, and the shipment's particulars are fetched
 * once, on first download.
 */
export function DocumentsMenu({ shipment, logoUrl }: { shipment: ShipmentRow; logoUrl: string | null }) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const docs = useRef<Promise<ShipmentDocuments | null> | null>(null);
  const [pending, setPending] = useState<DocumentKind | null>(null);
  const [failed, setFailed] = useState(false);
  const kinds = kindsFor(shipment);

  // Anchor the popover under its button before it shows, focus the first
  // item once it has, and close it if the page scrolls out from under it.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    function place(event: Event) {
      if ((event as ToggleEvent).newState !== "open" || !menu || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${Math.max(8, rect.right - MENU_WIDTH_PX)}px`;
    }
    function focusFirst(event: Event) {
      if ((event as ToggleEvent).newState === "open") menu?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    }
    function close(event: Event) {
      if (menu?.matches(":popover-open") && !menu.contains(event.target as Node)) menu.hidePopover();
    }
    menu.addEventListener("beforetoggle", place);
    menu.addEventListener("toggle", focusFirst);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => {
      menu.removeEventListener("beforetoggle", place);
      menu.removeEventListener("toggle", focusFirst);
      window.removeEventListener("scroll", close, { capture: true });
    };
  }, []);

  if (kinds.length === 0) {
    return (
      <span
        title="Created before documents carried full legal details. Generate it again to get documents."
        className="inline-grid size-8 place-items-center text-hairline-strong"
      >
        <FileText aria-hidden className="size-4" />
        <span className="sr-only">No documents: created before documents carried full legal details</span>
      </span>
    );
  }

  async function download(kind: DocumentKind) {
    if (pending) return;
    setPending(kind);
    setFailed(false);
    try {
      docs.current ??= getShipmentDocuments(shipment.id);
      const [data, logo] = await Promise.all([docs.current, loadInvoiceLogo(logoUrl)]);
      if (!data) throw new Error(`No document data for shipment ${shipment.id}`);
      await downloadDocument(kind, data, logo);
      menuRef.current?.hidePopover();
    } catch (error) {
      console.error("[DocumentsMenu] download failed:", error);
      docs.current = null;
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={menuId}
        onPointerEnter={preloadDocuments}
        onFocus={preloadDocuments}
        aria-haspopup="menu"
        aria-label={`Documents for ${shipment.invoice_number}`}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium outline-none",
          "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent",
          failed ? "text-danger hover:bg-danger-surface" : "text-ink-muted hover:bg-surface hover:text-ink hover:ring-1 hover:ring-hairline",
        )}
      >
        {pending ? <Spinner /> : failed ? <CircleAlert aria-hidden className="size-4" /> : <FileText aria-hidden className="size-4" />}
        <span className="hidden sm:inline">{kinds.length}</span>
        <ChevronDown aria-hidden className="size-3.5" />
      </button>

      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={`Documents for ${shipment.invoice_number}`}
        onKeyDown={handleKeyDown}
        className="fixed inset-auto m-0 w-64 rounded-lg border border-hairline bg-surface p-1 text-left text-ink shadow-card"
      >
        {kinds.map((kind) => {
          const { name } = DOCUMENT_KINDS.find((d) => d.kind === kind)!;
          return (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => download(kind)}
              aria-busy={pending === kind || undefined}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] outline-none hover:bg-ground focus-visible:bg-ground"
            >
              {pending === kind ? <Spinner /> : <FileText aria-hidden className="size-4 shrink-0 text-ink-muted" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{name}</span>
                <span className="block truncate text-xs text-ink-muted tabular-nums">
                  {documentFileName(kind, shipment.invoice_number!)}
                </span>
              </span>
            </button>
          );
        })}
        {failed && (
          <p role="alert" className="px-2.5 py-2 text-xs text-danger">
            Couldn&apos;t prepare the PDF. Try again.
          </p>
        )}
      </div>
    </>
  );
}
