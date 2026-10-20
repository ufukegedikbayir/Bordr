import type { Metadata } from "next";

import { NewShipment } from "@/components/features/customs/new-shipment";
import { getActiveWorkspace } from "@/services/workspaces/queries";

export const metadata: Metadata = { title: "New shipment · Bordr" };

export default function NewShipmentPage() {
  // Not awaited: the form renders at once and the workspace is read on submit.
  return <NewShipment activeWorkspace={getActiveWorkspace()} />;
}
