import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus } from "lucide-react";

import {
  HistoryError,
  HistorySkeleton,
  ShipmentTable,
} from "@/components/features/shipments/shipment-table";
import { buttonClass } from "@/components/ui/button";
import { listShipments } from "@/services/shipments/queries";
import { getUserWorkspaces } from "@/services/workspaces/queries";

export const metadata: Metadata = { title: "Dashboard · Bordr" };

async function ShipmentHistory() {
  const workspaces = await getUserWorkspaces();

  // proxy.ts should already have redirected; this guards against a matcher
  // gap, since the proxy must not be the only auth check.
  if (workspaces.status === "signed-out") redirect("/login");
  if (workspaces.status === "error") return <HistoryError />;

  const history = await listShipments(workspaces.active.id);
  if (history.status === "error") return <HistoryError />;

  return <ShipmentTable shipments={history.shipments} />;
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-balance sm:text-2xl">
            Shipments
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">
            Every customs classification in this workspace, newest first.
          </p>
        </div>
        <Link href="/shipments/new" className={buttonClass("primary", "shrink-0 self-start sm:self-auto")}>
          <Plus aria-hidden className="size-4" />
          New shipment
        </Link>
      </header>

      <Suspense fallback={<HistorySkeleton />}>
        <ShipmentHistory />
      </Suspense>
    </div>
  );
}
