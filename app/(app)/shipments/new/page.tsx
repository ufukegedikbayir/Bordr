import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2 } from "lucide-react";

import { NewShipment } from "@/components/features/customs/new-shipment";
import { isProfileComplete } from "@/services/workspaces/profile";
import { getActiveWorkspace, getCompanyProfile } from "@/services/workspaces/queries";

export const metadata: Metadata = { title: "New shipment · Bordr" };

/** Explains up front why generation will be refused, instead of after the user fills the form. */
async function ProfileNotice() {
  const workspace = await getActiveWorkspace();
  if (!workspace) return null;
  const profile = await getCompanyProfile(workspace.id);
  if (!profile || isProfileComplete(profile)) return null;

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-hairline-strong bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <Building2 aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-muted" />
        <div className="text-sm">
          <p className="font-medium">Your company profile is incomplete</p>
          <p className="mt-0.5 text-ink-muted">
            Invoices are issued in your company&apos;s name, so its registered details and EORI or VAT
            number are needed first.
            {workspace.role !== "owner" && " Ask a workspace owner to add them."}
          </p>
        </div>
      </div>
      {workspace.role === "owner" && (
        <Link
          href="/settings"
          className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-accent underline-offset-2 hover:underline sm:self-auto"
        >
          Complete profile
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

export default function NewShipmentPage() {
  return (
    <NewShipment
      // Not awaited: the form renders at once and the workspace is read on submit.
      activeWorkspace={getActiveWorkspace()}
      notice={
        <Suspense fallback={null}>
          <ProfileNotice />
        </Suspense>
      }
    />
  );
}
