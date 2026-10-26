// The create_shipment payload: validated input plus the AI classification,
// in the database's column names. Pure, so tests can run it against the
// migration without the Server Action.
import type { CustomsResult } from "./constants";
import { customsFormalities } from "./freight";
import type { ShipmentInput } from "./shipment-input";

type Classification = Pick<CustomsResult, "hsCode" | "hsDescription" | "estimatedDuty" | "requiredDocuments" | "country"> & {
  /** Whitespace-normalised goods description. */
  description: string;
};

export function createShipmentPayload(input: ShipmentInput, workspaceId: string, classification: Classification) {
  const { transport, dangerousGoods, consignee } = input;
  return {
    shipment: {
      workspace_id: workspaceId,
      description: classification.description,
      country: classification.country,
      hs_code: classification.hsCode,
      hs_description: classification.hsDescription,
      estimated_duty: classification.estimatedDuty,
      documents: classification.requiredDocuments,
      unit_price: input.unitPrice,
      currency: input.currency,
      incoterm: input.incoterm,
      incoterm_place: input.incotermPlace,
      country_of_origin: input.originCountry,
      importer_name: consignee.name,
      importer_address: consignee.address,
      importer_tax_id: consignee.taxId,
      carrier_name: transport.carrierName,
      carrier_address: transport.carrierAddress,
      carrier_country: transport.carrierCountry,
      vehicle_registration: transport.vehicleRegistration,
      trailer_registration: transport.trailerRegistration,
      taking_over_place: transport.takingOverPlace,
      taking_over_date: transport.takingOverDate,
      delivery_place: input.deliveryPlace,
      // Stored resolved, so the CMR re-prints identically whatever the code does later.
      sender_instructions: transport.senderInstructions ?? customsFormalities(input.incoterm),
      adr_un_number: dangerousGoods?.unNumber ?? null,
      adr_shipping_name: dangerousGoods?.shippingName ?? null,
      adr_class: dangerousGoods?.hazardClass ?? null,
      adr_packing_group: dangerousGoods?.packingGroup ?? null,
      adr_tunnel_code: dangerousGoods?.tunnelCode ?? null,
    },
    // Totals are not sent: the database computes them from these.
    packages: input.packages.map((p) => ({
      package_type: p.packageType,
      marks: p.marks,
      quantity: p.quantity,
      net_weight_kg: p.netWeightKg,
      gross_weight_kg: p.grossWeightKg,
      length_cm: p.lengthCm,
      width_cm: p.widthCm,
      height_cm: p.heightCm,
    })),
  };
}
