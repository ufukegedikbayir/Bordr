"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";

import { createServerClient } from "@/lib/supabase/server";

import { z } from "zod";

import { LOGO_BUCKET, MAX_LOGO_BYTES, logoObjectPath } from "./constants";
import { companyProfileSchema } from "./profile";
import { ACTIVE_WORKSPACE_COOKIE, getWorkspaceRole, isWorkspaceMember } from "./queries";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type LogoActionResult = { ok: true } | { ok: false; error: string };

const NOT_OWNER = "Only workspace owners can change the logo.";
const SAVE_FAILED = "Couldn't save the logo. Try again.";

/**
 * Makes `workspaceId` the active workspace. Setting the cookie re-renders the
 * current page and layouts, so the sidebar and data follow without a reload.
 */
export async function setActiveWorkspace(workspaceId: string): Promise<{ ok: boolean }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const id = String(workspaceId);
  if (!(await isWorkspaceMember(supabase, user.id, id))) return { ok: false };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return { ok: true };
}

/** Identifies PNG and JPEG by their magic bytes; the browser's MIME type is only a claim. */
function sniffImage(bytes: Uint8Array): { contentType: string; extension: string } | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  return null;
}

/** Signs in and confirms the caller owns `workspaceId`. RLS enforces the same on every write. */
async function authorizeOwner(workspaceId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await getWorkspaceRole(supabase, user.id, workspaceId);
  return role === "owner" ? supabase : null;
}

type Supabase = NonNullable<Awaited<ReturnType<typeof authorizeOwner>>>;

/** Points the workspace at `logoUrl` and deletes the file it replaces. */
async function replaceLogoUrl(supabase: Supabase, workspaceId: string, logoUrl: string | null) {
  const { data: current } = await supabase
    .from("workspaces")
    .select("logo_url")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: updated, error } = await supabase
    .from("workspaces")
    .update({ logo_url: logoUrl })
    .eq("id", workspaceId)
    .select("id");
  if (error || !updated?.length) {
    console.error("[workspace logo] update failed:", error?.code, error?.message ?? "no row updated");
    return false;
  }

  // Best effort: a leftover file is harmless, a failed swap isn't.
  const oldPath = current?.logo_url ? logoObjectPath(current.logo_url) : null;
  if (oldPath?.startsWith(`${workspaceId}/`)) {
    const { error: removeError } = await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);
    if (removeError) console.error("[workspace logo] removing old file failed:", removeError.message);
  }
  return true;
}

/** Uploads a PNG or JPEG (max 2 MB) as the workspace's invoice logo. */
export async function uploadWorkspaceLogo(formData: FormData): Promise<LogoActionResult> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "Logos must be under 2 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) return { ok: false, error: "Upload a PNG or JPEG image." };

  const supabase = await authorizeOwner(workspaceId);
  if (!supabase) return { ok: false, error: NOT_OWNER };

  // A fresh name per upload, so CDN and browser caches never serve a stale logo.
  const path = `${workspaceId}/logo-${crypto.randomUUID()}.${image.extension}`;
  const bucket = supabase.storage.from(LOGO_BUCKET);

  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: image.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) {
    console.error("[uploadWorkspaceLogo] upload failed:", uploadError.message);
    return { ok: false, error: SAVE_FAILED };
  }

  const {
    data: { publicUrl },
  } = bucket.getPublicUrl(path);

  if (!(await replaceLogoUrl(supabase, workspaceId, publicUrl))) {
    await bucket.remove([path]);
    return { ok: false, error: SAVE_FAILED };
  }

  refresh();
  return { ok: true };
}

export type ProfileActionState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; fieldErrors: Partial<Record<string, string[]>> }
  | { status: "error"; error: string };

/**
 * Saves the legal profile printed as the exporter on this workspace's invoices.
 * The id comes from the client, so ownership is re-checked here (and by RLS).
 */
export async function updateWorkspaceProfile(
  activeWorkspaceId: string,
  formData: FormData,
): Promise<ProfileActionState> {
  const workspaceId = String(activeWorkspaceId);
  const parsed = companyProfileSchema.safeParse(
    Object.fromEntries(Object.keys(companyProfileSchema.shape).map((key) => [key, String(formData.get(key) ?? "")])),
  );
  if (!parsed.success) return { status: "invalid", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await authorizeOwner(workspaceId);
  if (!supabase) return { status: "error", error: "Only workspace owners can change the company profile." };

  const profile = parsed.data;
  const { data, error } = await supabase
    .from("workspaces")
    .update({
      legal_name: profile.legalName,
      address_line1: profile.addressLine1,
      address_line2: profile.addressLine2,
      postal_code: profile.postalCode,
      city: profile.city,
      country_code: profile.countryCode,
      eori_number: profile.eoriNumber,
      tax_id: profile.taxId,
      signatory_name: profile.signatoryName,
      signatory_title: profile.signatoryTitle,
    })
    .eq("id", workspaceId)
    .select("id");

  if (error || !data?.length) {
    console.error("[updateWorkspaceProfile] update failed:", error?.code, error?.message ?? "no row updated");
    return { status: "error", error: "Couldn't save the company profile. Try again." };
  }

  refresh();
  return { status: "saved" };
}

/** Clears the workspace logo; invoices fall back to the text header. */
export async function removeWorkspaceLogo(workspaceId: string): Promise<LogoActionResult> {
  const id = String(workspaceId);
  const supabase = await authorizeOwner(id);
  if (!supabase) return { ok: false, error: NOT_OWNER };

  if (!(await replaceLogoUrl(supabase, id, null))) {
    return { ok: false, error: "Couldn't remove the logo. Try again." };
  }

  refresh();
  return { ok: true };
}
