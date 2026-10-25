import { createServerClient } from "@/lib/supabase/server";
import type { CountryCode } from "@/services/customs/constants";

export const HISTORY_LIMIT = 100;

export type ShipmentRow = {
  id: string;
  created_at: string;
  description: string;
  country: CountryCode | (string & {});
  hs_code: string;
  hs_description: string;
  estimated_duty: string;
  /** Null for shipments created before invoices carried the legal particulars. */
  invoice_number: string | null;
};

export type ShipmentHistory = { status: "ok"; shipments: ShipmentRow[] } | { status: "error" };

/**
 * A workspace's shipments, newest first. Callers resolve the workspace (and
 * the session) first; RLS returns nothing for workspaces the user isn't in.
 */
export async function listShipments(workspaceId: string): Promise<ShipmentHistory> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("shipments")
    .select("id, created_at, description, country, hs_code, hs_description, estimated_duty, invoice_number")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("[listShipments] query failed:", error.code, error.message);
    return { status: "error" };
  }

  return { status: "ok", shipments: data as ShipmentRow[] };
}
