import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard, AuthLink } from "@/components/features/auth/auth-card";
import { AcceptInvitation } from "@/components/features/workspaces/accept-invitation";
import { buttonClass } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { INVITE_TOKEN_PATTERN, invitePath } from "@/services/workspaces/invitation-rules";
import { switchAccountForInvitation } from "@/services/workspaces/invitations";
import { getInvitationPreview } from "@/services/workspaces/team";

export const metadata: Metadata = { title: "Invitation · Bordr" };

// Formatted on the server, so pinned to UTC.
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const roleName = (role: "owner" | "member") => (role === "owner" ? "an owner" : "a member");

function Invalid() {
  return (
    <AuthCard
      title="This invitation link isn't valid"
      description="It may have been mistyped, or revoked by the workspace owner. Ask them for a new invitation."
      footer={<AuthLink href="/">Go to Bordr</AuthLink>}
    >
      <Link href="/" className={buttonClass("secondary", "w-full")}>
        Go to Bordr
      </Link>
    </AuthCard>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!INVITE_TOKEN_PATTERN.test(token)) return <Invalid />;

  const supabase = await createServerClient();
  const [invitation, { data: auth }] = await Promise.all([getInvitationPreview(token), supabase.auth.getUser()]);
  if (!invitation) return <Invalid />;

  const { workspaceName, email, role } = invitation;
  const next = encodeURIComponent(invitePath(token));

  if (invitation.status === "accepted") {
    return (
      <AuthCard title="Invitation already accepted" description={`This invitation to ${workspaceName} has been used.`}>
        <Link href="/" className={buttonClass("primary", "w-full")}>
          Go to the dashboard
        </Link>
      </AuthCard>
    );
  }

  if (invitation.status === "expired") {
    return (
      <AuthCard
        title="This invitation has expired"
        description={`It expired on ${dateFormat.format(new Date(invitation.expiresAt))}. Ask an owner of ${workspaceName} to invite you again.`}
      >
        <Link href="/" className={buttonClass("secondary", "w-full")}>
          Go to Bordr
        </Link>
      </AuthCard>
    );
  }

  const user = auth.user;

  // Signed out: sign in or create an account with the invited address, then come back here.
  if (!user) {
    return (
      <AuthCard
        title={`Join ${workspaceName} on Bordr`}
        description={
          <>
            You&apos;ve been invited as {roleName(role)}. Sign in or create an account with{" "}
            <span className="font-medium text-ink">{email}</span> to accept.
          </>
        }
        footer={`The invitation expires on ${dateFormat.format(new Date(invitation.expiresAt))}.`}
      >
        <div className="grid gap-3">
          <Link href={`/login?next=${next}`} className={buttonClass("primary", "w-full")}>
            Sign in
          </Link>
          <Link href={`/signup?next=${next}`} className={buttonClass("secondary", "w-full")}>
            Create an account
          </Link>
        </div>
      </AuthCard>
    );
  }

  // Signed in with another address: the database would refuse, so say why first.
  if (user.email?.toLowerCase() !== email) {
    return (
      <AuthCard
        title="Sign in with the invited address"
        description={
          <>
            This invitation to {workspaceName} is for <span className="font-medium text-ink">{email}</span>, but
            you&apos;re signed in as <span className="font-medium text-ink">{user.email}</span>.
          </>
        }
      >
        <form action={switchAccountForInvitation.bind(null, token)}>
          <button type="submit" className={buttonClass("primary", "w-full")}>
            Sign out and switch account
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Join ${workspaceName}`}
      description={
        <>
          You&apos;ve been invited to join as {roleName(role)}. You&apos;ll see its shipments and documents, and can switch
          between workspaces at any time.
        </>
      }
      footer={`Signed in as ${user.email}`}
    >
      <AcceptInvitation token={token} workspaceName={workspaceName} />
    </AuthCard>
  );
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense
      fallback={
        <AuthCard title="Invitation" description="Loading the invitation…">
          <div aria-hidden className="skeleton h-10 rounded-lg" />
        </AuthCard>
      }
    >
      <Invitation params={params} />
    </Suspense>
  );
}
