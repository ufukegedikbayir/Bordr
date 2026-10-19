import type { Metadata } from "next";

import { NewShipment } from "@/components/features/customs/new-shipment";
import { getActiveWorkspaceId } from "@/services/workspaces/queries";

export const metadata: Metadata = { title: "New shipment · Bordr" };

export default function NewShipmentPage() {
  // Not awaited: the form renders at once and the id is read on submit.
  return <NewShipment activeWorkspaceId={getActiveWorkspaceId()} />;
}
