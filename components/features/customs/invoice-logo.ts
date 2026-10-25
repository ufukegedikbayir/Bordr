import { LOGO_TYPES, logoObjectPath } from "@/services/workspaces/constants";

const FETCH_TIMEOUT_MS = 5_000;

// One fetch per logo per page, however many invoices use it.
const cache = new Map<string, Promise<string | null>>();

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchLogo(logoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(logoUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const blob = await response.blob();
    if (!response.ok || !(LOGO_TYPES as readonly string[]).includes(blob.type)) return null;
    return await readAsDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * The workspace logo as a data URI the PDF renderer can embed, or null to use
 * the text header. Fetched up front so a missing or slow logo can't fail the
 * PDF, and only from our own Storage bucket.
 */
export function loadInvoiceLogo(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl || !logoObjectPath(logoUrl)) return Promise.resolve(null);

  let logo = cache.get(logoUrl);
  if (!logo) {
    logo = fetchLogo(logoUrl);
    cache.set(logoUrl, logo);
    // Don't pin a failure: the next download retries.
    void logo.then((result) => result ?? cache.delete(logoUrl));
  }
  return logo;
}
