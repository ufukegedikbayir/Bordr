import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed middleware.ts -> proxy.ts; behaviour is identical.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip API routes, Next internals (_next/*), and static files with an
    // extension (favicon.ico, images, fonts, robots.txt, ...). API routes
    // must enforce auth themselves.
    "/((?!api(?:/|$)|_next/|.*\\.[\\w]+$).*)",
  ],
};
