import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

// For Client Components. Auth state is read from and written to cookies,
// so it stays in sync with the server.
export function createBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseBrowserClient(url, anonKey);
}
