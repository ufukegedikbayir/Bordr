// The create_shipment payload: validated input plus the AI classification,
// in the database's column names. Pure, so tests can run it against the
// migration without the Server Action.
import { isIntraEu, type CustomsResult } from "./constants";
import { customsFormalities } from "./freight";
import type { ShipmentInput } from "./shipment-input";

type Classification = Pick<CustomsResult, "lines" | "requiredDocuments" | "country">;

export function createShipmentPayload(
  input: ShipmentInput,
  workspaceId: string,
  classification: Classification,
  /** The exporter's country, from the company profile. */
  exporterCountry: string,
) {
  const { transport, dangerousGoods, consignee } = input;
  return {
    shipment: {
      workspace_id: workspaceId,
      country: classification.country,
      documents: classification.requiredDocuments,
      currency: input.currency,
      incoterm: input.incoterm,
      incoterm_place: input.incotermPlace,
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
      sender_instructions: transport.senderInstructions ?? customsFormalities(input.incoterm, isIntraEu(exporterCountry, input.country)),
      adr_un_number: dangerousGoods?.unNumber ?? null,
      adr_shipping_name: dangerousGoods?.shippingName ?? null,
      adr_class: dangerousGoods?.hazardClass ?? null,
      adr_packing_group: dangerousGoods?.packingGroup ?? null,
      adr_tunnel_code: dangerousGoods?.tunnelCode ?? null,
    },
    // Quantities and weights are not sent: the database computes each line's
    // and the shipment's from the packages.
    lines: input.lines.map((line, i) => ({
      description: line.description,
      hs_code: classification.lines[i]!.hsCode,
      hs_description: classification.lines[i]!.hsDescription,
      estimated_duty: classification.lines[i]!.estimatedDuty,
      unit_price: line.unitPrice,
      origin_country: line.originCountry,
    })),
    packages: input.packages.map((p) => ({
      line: p.line,
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
