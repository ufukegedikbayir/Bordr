// Team and invitation reads. Server-only: they run under the caller's session,
// and RLS or the database functions decide what each caller may see.
import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

import type { InviteRole } from "./invitation-rules";
import type { WorkspaceRole } from "./queries";

export type TeamMember = { userId: string; email: string; role: WorkspaceRole; joinedAt: string };

export type PendingInvitation = {
  id: string;
  email: string;
  role: InviteRole;
  createdAt: string;
  expiresAt: string;
  /** Past its expiry: the link no longer works, and the address can be invited again. */
  expired: boolean;
};

export type InvitationPreview = {
  workspaceName: string;
  email: string;
  role: InviteRole;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
};

/** Members of a workspace with their email addresses. Empty unless the caller is a member. */
export async function getTeam(workspaceId: string): Promise<TeamMember[] | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("workspace_team", { target_workspace: workspaceId });
  if (error) {
    console.error("[getTeam] query failed:", error.code, error.message);
    return null;
  }
  return (data as Array<{ user_id: string; email: string; role: WorkspaceRole; joined_at: string }>).map((row) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
    joinedAt: row.joined_at,
  }));
}

/** Open invitations, newest first. RLS returns them to owners only. */
export async function listPendingInvitations(workspaceId: string): Promise<PendingInvitation[] | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listPendingInvitations] query failed:", error.code, error.message);
    return null;
  }
  const now = Date.now();
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as InviteRole,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    expired: new Date(row.expires_at).getTime() <= now,
  }));
}

/**
 * What an invitation link points to, for the invite page. Works signed out:
 * holding the token is the authorization. Null if the token matches nothing
 * (mistyped or revoked).
 */
export const getInvitationPreview = cache(async (token: string): Promise<InvitationPreview | null> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_workspace_invitation", { token });
  if (error) {
    console.error("[getInvitationPreview] query failed:", error.code, error.message);
    return null;
  }
  const row = (data as Array<{ workspace_name: string; email: string; role: InviteRole; status: InvitationPreview["status"]; expires_at: string }>)[0];
  return row
    ? { workspaceName: row.workspace_name, email: row.email, role: row.role, status: row.status, expiresAt: row.expires_at }
    : null;
});
