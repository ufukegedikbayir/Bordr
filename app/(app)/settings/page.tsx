import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { CompanyProfileForm } from "@/components/features/workspaces/company-profile-form";
import { LogoUploader } from "@/components/features/workspaces/logo-uploader";
import { SettingsTabs } from "@/components/features/workspaces/settings-tabs";
import { Alert } from "@/components/ui/alert";
import { getCompanyProfile, getUserWorkspaces } from "@/services/workspaces/queries";

export const metadata: Metadata = { title: "Settings · Bordr" };

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface shadow-card">
      <div className="border-b border-hairline px-6 py-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

async function WorkspaceSettings() {
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
  const profile = await getCompanyProfile(active.id);
  const canEdit = active.role === "owner";

  return (
    <div className="grid gap-6">
      {profile ? (
        // Keyed so switching workspace starts from that workspace's saved values.
        <CompanyProfileForm
          key={active.id}
          workspaceId={active.id}
          workspaceName={active.name}
          profile={profile}
          canEdit={canEdit}
        />
      ) : (
        <Alert>
          <p>Couldn&apos;t load the legal profile. Refresh the page to try again.</p>
        </Alert>
      )}

      <Section
        title="Invoice logo"
        description={
          <>
            Shown in the invoice header in place of your company name, on invoices issued in{" "}
            <span className="font-medium text-ink">{active.name}</span>.
          </>
        }
      >
        {/* Keyed so switching workspace starts from a clean slate. */}
        <LogoUploader key={active.id} workspaceId={active.id} logoUrl={active.logoUrl} canEdit={canEdit} />
      </Section>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6">
      <section aria-hidden className="rounded-xl border border-hairline bg-surface shadow-card">
        <div className="px-6 py-5">
          <h2 className="text-base font-semibold tracking-tight">Legal profile</h2>
          <p className="mt-1 text-[13px] text-ink-muted">The exporter on every invoice issued in this workspace.</p>
        </div>
        {[3, 2].map((rows, group) => (
          <div
            key={group}
            className="grid gap-x-10 gap-y-5 border-t border-hairline px-6 py-6 md:grid-cols-[13rem_minmax(0,1fr)]"
          >
            <div className="skeleton h-4 w-32 rounded" />
            <div className="grid gap-4">
              {Array.from({ length: rows }, (_, row) => (
                <div key={row} className="skeleton h-10 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
        <div className="h-15 rounded-b-xl border-t border-hairline bg-ground" />
      </section>
      <Section title="Invoice logo" description="Shown in the header of commercial invoices.">
        <div aria-hidden className="skeleton min-h-36 rounded-xl" />
      </Section>
      <p role="status" className="sr-only">
        Loading workspace settings…
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-[-0.015em] sm:text-2xl">Workspace settings</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Your company&apos;s legal identity and branding on the documents Bordr issues.</p>
        <SettingsTabs />
      </header>

      <Suspense fallback={<SettingsSkeleton />}>
        <WorkspaceSettings />
      </Suspense>
    </div>
  );
}
