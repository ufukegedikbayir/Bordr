// Shared by the workspace Server Actions and the UI. Kept out of actions.ts
// because a "use server" module may only export async functions.

export const LOGO_BUCKET = "workspace_assets";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
/** What the PDF renderer can draw. The bucket allows the same list. */
export const LOGO_TYPES = ["image/png", "image/jpeg"] as const;

const PUBLIC_PREFIX = `/storage/v1/object/public/${LOGO_BUCKET}/`;

/**
 * The object path of a logo URL, if it's a public file in our own bucket.
 * Anything else is untrusted and never fetched or deleted.
 */
export function logoObjectPath(logoUrl: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    const url = new URL(logoUrl);
    if (url.origin !== new URL(base).origin || !url.pathname.startsWith(PUBLIC_PREFIX)) return null;
    return decodeURIComponent(url.pathname.slice(PUBLIC_PREFIX.length)) || null;
  } catch {
    return null;
  }
}
