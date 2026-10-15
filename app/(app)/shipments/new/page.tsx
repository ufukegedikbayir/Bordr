import type { Metadata } from "next";

import { NewShipment } from "@/components/features/customs/new-shipment";

export const metadata: Metadata = { title: "New shipment · Bordr" };

export default function NewShipmentPage() {
  return <NewShipment />;
}
