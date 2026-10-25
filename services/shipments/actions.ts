"use server";

import { createServerClient } from "@/lib/supabase/server";
import { DOCUMENT_COLUMNS, documentsFromRow, type DocumentRow, type ShipmentDocuments } from "@/services/customs/documents";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A saved shipment's document particulars (invoice, packages, transport),
 * fetched when a PDF is requested so the history table doesn't ship them for
 * every row. RLS limits it to members of the shipment's workspace.
 */
export async function getShipmentDocuments(shipmentId: string): Promise<ShipmentDocuments | null> {
  const id = String(shipmentId);
  if (!UUID_PATTERN.test(id)) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("shipments").select(DOCUMENT_COLUMNS).eq("id", id).maybeSingle();

  if (error) console.error("[getShipmentDocuments] query failed:", error.code, error.message);
  return data ? documentsFromRow(data as unknown as DocumentRow) : null;
}
