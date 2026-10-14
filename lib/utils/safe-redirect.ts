const AUTH_PAGES = ["/login", "/signup"];

// Only allow same-origin relative paths, so ?next= can't be used as an open
// redirect ("//evil.com", "/\evil.com") or bounce back into the auth pages.
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  const pathname = value.split(/[?#]/)[0] ?? "";
  if (AUTH_PAGES.includes(pathname)) return fallback;
  return value;
}
