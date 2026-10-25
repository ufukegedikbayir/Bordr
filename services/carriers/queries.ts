import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

export type Carrier = { id: string; name: string; address: string; countryCode: string };

/**
 * The workspace's saved carriers, most recently used first, for the picker on
 * the new-shipment form. create_shipment saves them; RLS limits rows to members.
 */
export const listCarriers = cache(async (workspaceId: string): Promise<Carrier[]> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("carriers")
    .select("id, name, address, country_code")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    // The picker is a convenience: the form works without it.
    console.error("[listCarriers] query failed:", error.code, error.message);
    return [];
  }
  return data.map((row) => ({ id: row.id, name: row.name, address: row.address, countryCode: row.country_code }));
});
