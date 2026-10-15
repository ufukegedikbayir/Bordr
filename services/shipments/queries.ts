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
};

export type ShipmentHistory =
  | { status: "ok"; shipments: ShipmentRow[] }
  | { status: "signed-out" }
  | { status: "error" };

/** The signed-in user's shipments, newest first. RLS also scopes rows to them. */
export async function listShipments(): Promise<ShipmentHistory> {
  const supabase = await createServerClient();
  // getUser() revalidates the session with the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };

  const { data, error } = await supabase
    .from("shipments")
    .select("id, created_at, description, country, hs_code, hs_description, estimated_duty")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("[listShipments] query failed:", error.code, error.message);
    return { status: "error" };
  }

  return { status: "ok", shipments: data as ShipmentRow[] };
}
