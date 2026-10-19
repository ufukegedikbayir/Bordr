"use server";

import { cookies } from "next/headers";

import { createServerClient } from "@/lib/supabase/server";

import { ACTIVE_WORKSPACE_COOKIE, isWorkspaceMember } from "./queries";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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
