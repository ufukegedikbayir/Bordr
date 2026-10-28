"use server";

import { createHash, randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { setActiveWorkspace } from "./actions";
import { INVITE_TOKEN_PATTERN, inviteSchema, invitePath, type InviteRole } from "./invitation-rules";
import { getActiveWorkspace } from "./queries";

export type InviteResult =
  | {
      ok: true;
      email: string;
      role: InviteRole;
      /** "/invites/<token>". Shown once to the owner: only the token's hash is stored. */
      path: string;
    }
  | { ok: false; error: string; field?: "email" | "role" };

export type InvitationActionResult = { ok: true } | { ok: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Database hints (see 20261028000001_team_invitations.sql) -> what the user reads.
const INVITE_ERRORS: Record<string, { error: string; field?: "email" | "role" }> = {
  not_owner: { error: "Only workspace owners can invite people." },
  already_member: { error: "This person is already a member of the workspace.", field: "email" },
  already_invited: { error: "This address already has an open invitation. Revoke it first to send a new one.", field: "email" },
  too_many_invitations: { error: "This workspace has 50 open invitations. Revoke some before inviting more." },
  invalid_role: { error: "Choose a role.", field: "role" },
};

const ACCEPT_ERRORS: Record<string, string> = {
  invalid_token: "This invitation link isn't valid. It may have been revoked.",
  already_used: "This invitation has already been used.",
  expired: "This invitation has expired. Ask an owner to invite you again.",
  wrong_account: "This invitation is for a different email address.",
  email_unconfirmed: "Confirm your email address first, then open the link again.",
};

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/**
 * Invites `email` to the active workspace. Owners only: checked here for a
 * clear message, and again by the database, which is the check that counts.
 * Until email delivery exists, the link is returned to the owner (and logged
 * in development) for them to pass on.
 */
export async function inviteUser(email: string, role: string): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse({ email, role });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the details.", field: issue?.path[0] === "role" ? "role" : "email" };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again to invite people." };

  // The workspace comes from the server-side session, never from the client.
  const workspace = await getActiveWorkspace();
  if (!workspace) return { ok: false, error: "Couldn't load your workspace. Reload the page and try again." };
  if (workspace.role !== "owner") return { ok: false, error: INVITE_ERRORS.not_owner!.error };

  // 256 random bits. Only the hash goes to the database.
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.rpc("create_workspace_invitation", {
    target_workspace: workspace.id,
    invitee_email: parsed.data.email,
    invitee_role: parsed.data.role,
    hashed_token: hashToken(token),
  });

  if (error) {
    const known = error.hint ? INVITE_ERRORS[error.hint] : undefined;
    if (!known) console.error("[inviteUser] failed:", error.code, error.message);
    return { ok: false, ...(known ?? { error: "Couldn't create the invitation. Try again." }) };
  }

  const path = invitePath(token);
  if (process.env.NODE_ENV !== "production") {
    // No email delivery yet: the link is the invitation. Never logged in production.
    const requestHeaders = await headers();
    const origin = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host") ?? "localhost:3000"}`;
    console.log(`[inviteUser] Invitation for ${parsed.data.email} (${parsed.data.role}) to "${workspace.name}": ${origin}${path}`);
  }

  refresh();
  return { ok: true, email: parsed.data.email, role: parsed.data.role, path };
}

/** Revokes a pending invitation in the active workspace. RLS limits it to owners. */
export async function revokeInvitation(invitationId: string): Promise<InvitationActionResult> {
  const id = String(invitationId);
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invitation not found." };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again to manage invitations." };

  const workspace = await getActiveWorkspace();
  if (!workspace || workspace.role !== "owner") return { ok: false, error: "Only workspace owners can revoke invitations." };

  const { data, error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("[revokeInvitation] failed:", error.code, error.message);
    return { ok: false, error: "Couldn't revoke the invitation. Try again." };
  }
  if (!data?.length) return { ok: false, error: "This invitation was already accepted or revoked." };

  refresh();
  return { ok: true };
}

/**
 * Joins the workspace the invitation is for, as the signed-in user. The
 * database checks the token, its expiry, and that the user's confirmed email
 * is the invited one. On success the joined workspace becomes the active one.
 */
export async function acceptInvitation(token: string): Promise<InvitationActionResult> {
  const value = String(token);
  if (!INVITE_TOKEN_PATTERN.test(value)) return { ok: false, error: ACCEPT_ERRORS.invalid_token! };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to accept the invitation." };

  const { data: workspaceId, error } = await supabase.rpc("accept_workspace_invitation", { token: value });
  if (error || typeof workspaceId !== "string") {
    const known = error?.hint ? ACCEPT_ERRORS[error.hint] : undefined;
    if (!known) console.error("[acceptInvitation] failed:", error?.code, error?.message);
    return { ok: false, error: known ?? "Couldn't accept the invitation. Try again." };
  }

  await setActiveWorkspace(workspaceId);
  redirect("/");
}

/** Signs out and returns to sign-in, then back to the invitation: for the "wrong account" case. */
export async function switchAccountForInvitation(token: string): Promise<void> {
  const value = String(token);
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect(INVITE_TOKEN_PATTERN.test(value) ? `/login?next=${encodeURIComponent(invitePath(value))}` : "/login");
}
