"use client";

import { useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { revokeInvitation } from "@/services/workspaces/invitations";

/** Revokes on the first click; the row disappears when the page refreshes. */
export function RevokeInvitation({ invitationId, email }: { invitationId: string; email: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await revokeInvitation(invitationId);
      if (!result.ok) setError(result.error);
    } catch {
      setError("Couldn't revoke the invitation. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={revoke}
        aria-busy={pending || undefined}
        aria-label={`Revoke the invitation for ${email}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-danger outline-none transition-colors duration-150 hover:bg-danger-surface focus-visible:ring-2 focus-visible:ring-accent"
      >
        {pending && <Spinner />}
        Revoke
      </button>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
