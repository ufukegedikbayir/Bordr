import { cookies } from "next/headers";
import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

import { PROFILE_COLUMNS, profileFromRow, type CompanyProfile, type ProfileRow } from "./profile";

/** Remembers the selected workspace across reloads. Always re-checked against membership. */
export const ACTIVE_WORKSPACE_COOKIE = "bordr-workspace";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WorkspaceRole = "owner" | "member";

export type Workspace = { id: string; name: string; role: WorkspaceRole; logoUrl: string | null };

export type UserWorkspaces =
  | { status: "ok"; workspaces: Workspace[]; active: Workspace }
  | { status: "signed-out" }
  | { status: "error" };

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>;

type MembershipRow = {
  role: WorkspaceRole;
  workspace: { id: string; name: string; logo_url: string | null } | null;
};

/**
 * The signed-in user's workspaces (oldest membership first) and the active
 * one: the cookie's workspace if they still belong to it, else the first.
 * Cached per request, so the sidebar and the page share one lookup.
 */
export const getUserWorkspaces = cache(async (): Promise<UserWorkspaces> => {
  const supabase = await createServerClient();
  // getUser() revalidates the session with the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };

  const [{ data, error }, cookieStore] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, workspace:workspaces!inner (id, name, logo_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    cookies(),
  ]);

  if (error) {
    console.error("[getUserWorkspaces] query failed:", error.code, error.message);
    return { status: "error" };
  }

  const workspaces = (data as unknown as MembershipRow[]).flatMap(({ role, workspace }) =>
    workspace ? [{ id: workspace.id, name: workspace.name, role, logoUrl: workspace.logo_url }] : [],
  );

  // Sign-up creates a personal workspace and its owner can't leave it, so
  // this means the database and app are out of sync.
  const [oldest] = workspaces;
  if (!oldest) {
    console.error("[getUserWorkspaces] user has no workspace:", user.id);
    return { status: "error" };
  }

  const selectedId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = workspaces.find(({ id }) => id === selectedId) ?? oldest;

  return { status: "ok", workspaces, active };
});

/** The active workspace, or null when there's none to act in. */
export async function getActiveWorkspace(): Promise<Workspace | null> {
  const result = await getUserWorkspaces();
  return result.status === "ok" ? result.active : null;
}

/** The workspace's company profile, or null if it can't be read. RLS limits it to members. */
export const getCompanyProfile = cache(async (workspaceId: string): Promise<CompanyProfile | null> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select(PROFILE_COLUMNS)
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[getCompanyProfile] query failed:", error.code, error.message);
    return null;
  }
  return profileFromRow(data as ProfileRow);
});

/** `userId`'s role in `workspaceId`, or null if they aren't a member. For authorizing writes. */
export async function getWorkspaceRole(
  supabase: SupabaseServerClient,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  if (!UUID_PATTERN.test(workspaceId)) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getWorkspaceRole] query failed:", error.code, error.message);
    return null;
  }
  return (data?.role as WorkspaceRole | undefined) ?? null;
}

/** Whether `userId` belongs to `workspaceId`. */
export async function isWorkspaceMember(
  supabase: SupabaseServerClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return (await getWorkspaceRole(supabase, userId, workspaceId)) !== null;
}
