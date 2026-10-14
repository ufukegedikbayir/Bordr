import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

// For Server Components, Server Functions and Route Handlers.
// Create a new client per request — never share one across requests.
export async function createServerClient() {
  // Await cookies() first: it opts the route into dynamic rendering, so the
  // build never prerenders (and never needs env vars for) authed pages.
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't write cookies. Safe to ignore: proxy.ts
          // refreshes the session before the page renders.
        }
      },
    },
  });
}
