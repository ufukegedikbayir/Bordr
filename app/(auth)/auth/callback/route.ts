import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils/safe-redirect";

// Landing point for email links (signup confirmation, later magic links and
// password resets). Handles both the PKCE `code` flow (default for
// @supabase/ssr) and `token_hash` links from customised email templates.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createServerClient();
  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
  }

  return NextResponse.redirect(
    new URL(verified ? next : "/login?error=confirmation_failed", origin),
  );
}
