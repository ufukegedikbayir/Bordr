import { cookies } from "next/headers";
import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

/** Remembers the selected workspace across reloads. Always re-checked against membership. */
export const ACTIVE_WORKSPACE_COOKIE = "bordr-workspace";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WorkspaceRole = "owner" | "member";

export type Workspace = { id: string; name: string; role: WorkspaceRole };

export type UserWorkspaces =
  | { status: "ok"; workspaces: Workspace[]; active: Workspace }
  | { status: "signed-out" }
  | { status: "error" };

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>;

type MembershipRow = {
  role: WorkspaceRole;
  workspace: { id: string; name: string } | null;
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
      .select("role, workspace:workspaces!inner (id, name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    cookies(),
  ]);

  if (error) {
    console.error("[getUserWorkspaces] query failed:", error.code, error.message);
    return { status: "error" };
  }

  const workspaces = (data as unknown as MembershipRow[]).flatMap(({ role, workspace }) =>
    workspace ? [{ id: workspace.id, name: workspace.name, role }] : [],
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

/** The active workspace's id, or null when there's none to act in. */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const result = await getUserWorkspaces();
  return result.status === "ok" ? result.active.id : null;
}

/** Whether `userId` belongs to `workspaceId`. For authorizing writes before they happen. */
export async function isWorkspaceMember(
  supabase: SupabaseServerClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(workspaceId)) return false;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[isWorkspaceMember] query failed:", error.code, error.message);
    return false;
  }
  return data !== null;
}
