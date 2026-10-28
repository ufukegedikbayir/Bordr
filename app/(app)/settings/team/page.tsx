import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { InviteDialog } from "@/components/features/workspaces/invite-dialog";
import { RevokeInvitation } from "@/components/features/workspaces/revoke-invitation";
import { SettingsTabs } from "@/components/features/workspaces/settings-tabs";
import { Alert } from "@/components/ui/alert";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import { getUserWorkspaces } from "@/services/workspaces/queries";
import { getTeam, listPendingInvitations } from "@/services/workspaces/team";

export const metadata: Metadata = { title: "Team · Bordr" };

// Formatted on the server, so pinned to UTC.
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Section({ title, description, aside, children }: { title: string; description: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function RoleBadge({ role }: { role: "owner" | "member" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        role === "owner" ? "bg-accent-surface text-accent ring-accent/20" : "bg-ground text-ink-muted ring-hairline-strong",
      )}
    >
      {role === "owner" ? "Owner" : "Member"}
    </span>
  );
}

async function Team() {
  const result = await getUserWorkspaces();
  // proxy.ts should already have redirected; the proxy must not be the only check.
  if (result.status === "signed-out") redirect("/login");
  if (result.status === "error") {
    return (
      <Alert>
        <p className="font-medium">Couldn&apos;t load your workspace.</p>
        <p className="mt-0.5">Refresh the page to try again.</p>
      </Alert>
    );
  }

  const { active } = result;
  const isOwner = active.role === "owner";
  const supabase = await createServerClient();
  const [team, invitations, { data: auth }] = await Promise.all([
    getTeam(active.id),
    // Owners only: RLS would return nothing to members anyway.
    isOwner ? listPendingInvitations(active.id) : Promise.resolve([]),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="grid gap-6">
      <Section
        title="Members"
        description={
          <>
            People who can create shipments and download documents in <span className="font-medium text-ink">{active.name}</span>.
          </>
        }
        aside={isOwner ? <InviteDialog workspaceName={active.name} /> : null}
      >
        {team ? (
          <ul className="divide-y divide-hairline">
            {team.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.email}
                    {member.userId === auth.user?.id && <span className="ml-1.5 font-normal text-ink-muted">(you)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">Joined {dateFormat.format(new Date(member.joinedAt))}</p>
                </div>
                <RoleBadge role={member.role} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-5 text-sm text-danger">Couldn&apos;t load the members. Refresh the page to try again.</p>
        )}
      </Section>

      {isOwner && (
        <Section title="Pending invitations" description="Invitations that haven't been accepted yet. Revoking one stops its link working.">
          {invitations === null ? (
            <p className="px-6 py-5 text-sm text-danger">Couldn&apos;t load the invitations. Refresh the page to try again.</p>
          ) : invitations.length === 0 ? (
            <p className="px-6 py-5 text-sm text-ink-muted">No pending invitations.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{invitation.email}</span>
                      <RoleBadge role={invitation.role} />
                    </p>
                    <p className={cn("mt-0.5 text-xs", invitation.expired ? "text-danger" : "text-ink-muted")}>
                      {invitation.expired
                        ? `Expired ${dateFormat.format(new Date(invitation.expiresAt))}. Revoke it to invite this address again.`
                        : `Sent ${dateFormat.format(new Date(invitation.createdAt))} · expires ${dateFormat.format(new Date(invitation.expiresAt))}`}
                    </p>
                  </div>
                  <RevokeInvitation invitationId={invitation.id} email={invitation.email} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {!isOwner && (
        <p className="text-[13px] text-ink-muted">Only owners can invite people or see pending invitations.</p>
      )}
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      <section className="rounded-xl border border-hairline bg-surface shadow-card">
        <div className="border-b border-hairline px-6 py-4">
          <h2 className="text-sm font-semibold tracking-tight">Members</h2>
          <div className="skeleton mt-2 h-3.5 w-64 max-w-full rounded" />
        </div>
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center justify-between border-b border-hairline px-6 py-4 last:border-0">
            <div className="skeleton h-4 w-48 rounded" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
        ))}
      </section>
    </div>
  );
}

export default function TeamPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-[-0.015em] sm:text-2xl">Workspace settings</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Who can work in this workspace, and with what role.</p>
        <SettingsTabs />
      </header>

      <Suspense
        fallback={
          <>
            <TeamSkeleton />
            <p role="status" className="sr-only">
              Loading the team…
            </p>
          </>
        }
      >
        <Team />
      </Suspense>
    </div>
  );
}
