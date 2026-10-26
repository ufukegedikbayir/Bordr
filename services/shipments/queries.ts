import { createServerClient } from "@/lib/supabase/server";
import type { CountryCode } from "@/services/customs/constants";

export const HISTORY_LIMIT = 100;

export type ShipmentLineSummary = {
  position: number;
  description: string;
  hs_code: string;
  hs_description: string;
  estimated_duty: string;
};

export type ShipmentRow = {
  id: string;
  created_at: string;
  country: CountryCode | (string & {});
  /** Invoice lines, ordered by item number; at least one. */
  lines: ShipmentLineSummary[];
  /** Null for shipments created before invoices carried the legal particulars. */
  invoice_number: string | null;
  /** Null for shipments created before transport details (CMR) were recorded. */
  vehicle_registration: string | null;
  /** Packages recorded for the shipment; 0 before the packing list existed. */
  package_rows: number;
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
    .select(
      "id, created_at, country, invoice_number, vehicle_registration, shipment_lines (position, description, hs_code, hs_description, estimated_duty), shipment_packages (count)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("[listShipments] query failed:", error.code, error.message);
    return { status: "error" };
  }

  // PostgREST returns the embedded count as [{ count: n }].
  type Raw = Omit<ShipmentRow, "package_rows" | "lines"> & {
    shipment_lines: ShipmentLineSummary[] | null;
    shipment_packages: Array<{ count: number }> | null;
  };
  const shipments = (data as unknown as Raw[]).map(({ shipment_lines, shipment_packages, ...row }) => ({
    ...row,
    lines: [...(shipment_lines ?? [])].sort((a, b) => a.position - b.position),
    package_rows: shipment_packages?.[0]?.count ?? 0,
  }));
  return { status: "ok", shipments };
}
