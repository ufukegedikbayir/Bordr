"use server";

import { createServerClient } from "@/lib/supabase/server";
import { INVOICE_COLUMNS, invoiceFromRow, type InvoiceData } from "@/services/customs/invoice";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A saved shipment's invoice particulars, fetched when its PDF is requested so
 * the history table doesn't ship them for every row. RLS limits it to members
 * of the shipment's workspace.
 */
export async function getShipmentInvoice(shipmentId: string): Promise<InvoiceData | null> {
  const id = String(shipmentId);
  if (!UUID_PATTERN.test(id)) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("shipments").select(INVOICE_COLUMNS).eq("id", id).maybeSingle();

  if (error) console.error("[getShipmentInvoice] query failed:", error.code, error.message);
  return data ? invoiceFromRow(data) : null;
}
