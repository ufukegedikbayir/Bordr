import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./env";

// Routes reachable without a session. Everything else is treated as part of
// the authenticated (app) group — route groups don't appear in the URL, so
// protection is deny-by-default. Add (marketing) routes here as they ship.
// /invites shows who invited whom before sign-in; joining still needs a session.
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/invites"];

// Signed-in users have no reason to see these; send them to the app.
const AUTH_PAGES = ["/login", "/signup"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // If emailRedirectTo isn't in Supabase's Redirect URL allow-list, Supabase
  // falls back to the Site URL ("/"). Forward the auth params to the handler.
  if (
    pathname === "/" &&
    ["code", "token_hash", "error_code"].some((key) => searchParams.has(key))
  ) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  const { url, anonKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Mirror refreshed tokens onto the request (for this render) and the
        // response (for the browser).
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // No-store headers so a CDN never serves one user's session to another.
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Don't run code between createServerClient and getClaims — it can cause
  // hard-to-debug random logouts. getClaims verifies the JWT and refreshes
  // an expired session.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return redirectWithSession(loginUrl, response);
  }

  if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/";
    appUrl.search = "";
    return redirectWithSession(appUrl, response);
  }

  return response;
}

// Carry over any cookie changes (refreshed or cleared session) and the
// no-store cache headers onto a redirect.
function redirectWithSession(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  response.headers.forEach((value, key) => {
    if (key !== "x-middleware-next") redirect.headers.set(key, value);
  });
  return redirect;
}
