"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/services/workspaces/invitations";

/** Joins the workspace; on success the action redirects to the dashboard. */
export function AcceptInvitation({ token, workspaceName }: { token: string; workspaceName: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await acceptInvitation(token);
      // Only failures return; success redirects.
      if (!result.ok) setError(result.error);
    } catch (thrown) {
      // A redirect surfaces here as a thrown navigation signal; let Next handle it.
      if (thrown && typeof thrown === "object" && "digest" in thrown) throw thrown;
      setError("Couldn't accept the invitation. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Button type="button" onClick={accept} loading={pending} className="w-full">
        Join {workspaceName}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
