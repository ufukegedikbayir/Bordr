import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { LogoUploader } from "@/components/features/workspaces/logo-uploader";
import { Alert } from "@/components/ui/alert";
import { getUserWorkspaces } from "@/services/workspaces/queries";

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

async function LogoSettings() {
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
  return (
    <Section
      title="Invoice logo"
      description={
        <>
          Replaces the Bordr wordmark on commercial invoices generated in{" "}
          <span className="font-medium text-ink">{active.name}</span>.
        </>
      }
    >
      {/* Keyed so switching workspace starts from a clean slate. */}
      <LogoUploader
        key={active.id}
        workspaceId={active.id}
        logoUrl={active.logoUrl}
        canEdit={active.role === "owner"}
      />
    </Section>
  );
}

function LogoSettingsSkeleton() {
  return (
    <Section title="Invoice logo" description="Replaces the Bordr wordmark on commercial invoices.">
      <div aria-hidden className="skeleton min-h-36 rounded-xl" />
      <p role="status" className="sr-only">
        Loading workspace settings…
      </p>
    </Section>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-[-0.015em] sm:text-2xl">Workspace settings</h1>
        <p className="mt-1.5 text-sm text-ink-muted">How your workspace appears on the documents you generate.</p>
      </header>

      <Suspense fallback={<LogoSettingsSkeleton />}>
        <LogoSettings />
      </Suspense>
    </div>
  );
}
