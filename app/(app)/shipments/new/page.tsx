import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2, Check } from "lucide-react";

import { NewShipment } from "@/components/features/customs/new-shipment";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { PROFILE_REQUIREMENTS, isProfileComplete, type CompanyProfile } from "@/services/workspaces/profile";
import { getActiveWorkspace, getCompanyProfile, type Workspace } from "@/services/workspaces/queries";

export const metadata: Metadata = { title: "New shipment · Bordr" };

/**
 * Stands in for the form while the workspace can't issue invoices: the database
 * would refuse the shipment anyway, so the user shouldn't fill it in first.
 */
function ProfileGate({ workspace, profile }: { workspace: Workspace; profile: CompanyProfile }) {
  const isOwner = workspace.role === "owner";

  return (
    <section
      aria-labelledby="profile-gate-heading"
      className="max-w-2xl rounded-xl border border-hairline bg-surface shadow-card"
    >
      <div className="px-6 pt-7 pb-6 sm:px-8">
        <div className="flex size-10 items-center justify-center rounded-lg border border-hairline bg-ground">
          <Building2 aria-hidden className="size-5 text-ink" />
        </div>
        <h2 id="profile-gate-heading" className="mt-5 text-base font-semibold tracking-tight">
          Set up your legal profile to issue invoices
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">
          Invoices issued in <span className="font-medium text-ink">{workspace.name}</span> name your
          company as the exporter. Customs need its registered details and an EORI or VAT number, so
          Bordr asks for them once, before the first shipment.
        </p>

        <ul className="mt-6 grid gap-2.5">
          {PROFILE_REQUIREMENTS.map(({ label, met }) => {
            const done = met(profile);
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    done ? "bg-accent text-accent-ink" : "border border-hairline-strong",
                  )}
                >
                  {done && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={cn(done && "text-ink-muted")}>{label}</span>
                <span className="sr-only">{done ? "(done)" : "(missing)"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-3 rounded-b-xl border-t border-hairline bg-ground px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-[13px] text-ink-muted">
          {isOwner
            ? "You enter these once. Every invoice after that uses them."
            : "Only a workspace owner can add these. Ask an owner to complete the legal profile."}
        </p>
        {isOwner && (
          <Link href="/settings" className={buttonClass("primary", "h-9 shrink-0")}>
            Complete legal profile
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </section>
  );
}

async function ShipmentWorkspace() {
  const workspace = await getActiveWorkspace();
  if (!workspace) {
    return (
      <Alert>
        <p className="font-medium">Couldn&apos;t load your workspace.</p>
        <p className="mt-0.5">Refresh the page to try again.</p>
      </Alert>
    );
  }

  // If the profile can't be read, let the form through: the server refuses
  // the shipment with a clear message if the profile really is incomplete.
  const profile = await getCompanyProfile(workspace.id);
  if (profile && !isProfileComplete(profile)) return <ProfileGate workspace={workspace} profile={profile} />;

  return <NewShipment workspace={workspace} />;
}

function ShipmentSkeleton() {
  return (
    <div aria-hidden className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="rounded-xl border border-hairline bg-surface shadow-card">
        <div className="h-13 border-b border-hairline" />
        <div className="grid gap-4 p-6">
          <div className="skeleton h-20 rounded-lg" />
          <div className="skeleton h-10 rounded-lg" />
          <div className="skeleton h-10 rounded-lg" />
          <div className="skeleton h-10 rounded-lg" />
        </div>
      </div>
      <div className="min-h-80 rounded-xl border border-hairline bg-surface shadow-card" />
    </div>
  );
}

export default function NewShipmentPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-[-0.015em] sm:text-2xl">New shipment</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">
          Declare the goods and delivery terms. Bordr classifies them, estimates import duty and
          issues a commercial invoice in your company&apos;s name.
        </p>
      </header>

      <Suspense
        fallback={
          <>
            <ShipmentSkeleton />
            <p role="status" className="sr-only">
              Loading…
            </p>
          </>
        }
      >
        <ShipmentWorkspace />
      </Suspense>
    </div>
  );
}
