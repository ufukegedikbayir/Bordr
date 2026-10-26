# Customs document suite: architecture

Bordr issues four documents for an international road shipment. They are
generated from one saved record, so every figure (packages, weights, values,
parties) is identical across them.

| Document | Legal basis | Who signs | Bordr's role |
| --- | --- | --- | --- |
| Commercial invoice | Customs valuation (WCO / Union Customs Code) | Exporter | Issues it, numbered `INV-YYYY-NNNNN` |
| Packing list | Commercial practice, required by customs and carriers to examine goods | Exporter | Issues it, `PL-YYYY-NNNNN` |
| CMR consignment note | CMR Convention (Geneva, 1956), Art. 4–9 | Sender **and** carrier; consignee on delivery | Prepares the three originals, `CMR-YYYY-NNNNN` |
| Certificate of origin (non-preferential) | Chamber-of-commerce certification, Eurochambres guidelines | Exporter applies; chamber certifies | Prepares the **application**, `COO-YYYY-NNNNN` |

All four share the shipment's sequence number (`INV-2026-00042` ↔ `CMR-2026-00042`),
so a border officer can match them at a glance.

## Principles

1. **Users declare facts; the AI only classifies.** The AI suggests the HS code
   and flags compliance risks. It never supplies a party, weight, value, origin,
   UN number or vehicle. The exporter and carrier sign these documents.
2. **One source of truth per figure.** Shipment totals (packages, quantity, net
   and gross weight) are computed by the database from the package rows, never
   accepted from the client.
3. **Issued documents never change.** Exporter and carrier details are copied
   onto the shipment when it's created (snapshots). Editing the company profile
   or a saved carrier later affects new shipments only.
4. **Validate in three places with the same rules.** Live in the form, again in
   the Server Action, and finally as database constraints.

## 1. CMR consignment note

### Mandatory particulars: CMR Art. 6(1)

| Art. | Particular | Source in Bordr | CMR box |
| --- | --- | --- | --- |
| 6(1)(a) | Date and place at which the note is made out | Place and date of taking over | 21 |
| 6(1)(b) | Name and address of the sender | Company profile snapshot | 1 |
| 6(1)(c) | Name and address of the carrier | Carrier snapshot | 16 |
| 6(1)(d) | Place and date of taking over; place designated for delivery | `taking_over_place`, `taking_over_date`, `delivery_place` | 4, 3 |
| 6(1)(e) | Name and address of the consignee | `importer_name`, `importer_address` | 2 |
| 6(1)(f) | Description in common use of the goods and method of packing; for dangerous goods, their generally recognised description | Goods description, package types, ADR line | 8, 9 |
| 6(1)(g) | Number of packages and their special marks and numbers | `shipment_packages` (count, marks) | 6, 7 |
| 6(1)(h) | Gross weight or quantity otherwise expressed | Sum of package gross weights; volume | 11, 12 |
| 6(1)(i) | Charges relating to the carriage | Payer derived from the Incoterm; amounts left for the parties | 14, 20 |
| 6(1)(j) | Instructions required for customs and other formalities | `sender_instructions`, defaulting to the Incoterm's clearance split | 13 |
| 6(1)(k) | Statement that the carriage is subject to the CMR Convention | Printed on every copy | Footer |

Omitting the 6(1)(k) statement makes the carrier liable for all resulting loss
(Art. 7(3)), so it is printed on every copy.

### Where applicable: Art. 6(2)

| Art. | Particular | Status |
| --- | --- | --- |
| 6(2)(a) | Transhipment not allowed | Box 19 (special agreements), left for the parties |
| 6(2)(b) | Charges the sender undertakes to pay | Box 20 |
| 6(2)(c) | Cash on delivery | Box 15, blank (not supported yet) |
| 6(2)(d) | Declared value / special interest in delivery | Not supported yet (Art. 24, 26) |
| 6(2)(e) | Insurance instructions | Not supported yet |
| 6(2)(f) | Agreed time limit | Not supported yet |
| 6(2)(g) | List of documents handed to the carrier | Box 5: invoice, packing list, certificate of origin numbers |

### Form rules

- **Three originals** (Art. 5(1)), signed by sender and carrier: copy 1 for the
  sender, copy 2 travels with the goods, copy 3 stays with the carrier. Bordr
  prints all three, each labelled.
- **One note per vehicle** (Art. 5(2)): a shipment is one vehicle. Payload is
  limited to 30 t and 120 m³, so heavier loads must be split into shipments.
- The box layout follows the IRU model form (boxes 1–24) that border officers know.
- **Freight payment (box 14), derived from Incoterms® 2020.** Under EXW and FCA
  the buyer contracts the main carriage, so it's *carriage forward*. Under CPT,
  CIP, DAP, DPU and DDP the seller pays, so it's *carriage paid*.
- **Customs formalities (box 13 default), also from Incoterms® 2020.**
  - EXW: the buyer clears export and import.
  - DDP: the seller clears export and import.
  - All other rules: the seller clears export, the buyer clears import.
- **Sender.** Bordr prints the exporter as the sender. Under EXW or FCA, the
  party contracting the carrier may legally be the buyer; the parties can
  correct this before signing.

### Dangerous goods (ADR 5.4.1)

If the goods are dangerous under ADR, the transport document must carry, in
this order:

`UN number, proper shipping name, label model number(s) (class), packing group, (tunnel restriction code)`

For example: `UN 1263 PAINT, 3, III, (D/E)`.

Stored per shipment:

- `adr_un_number`: four digits; the document prints the "UN" prefix.
- `adr_shipping_name`: the proper shipping name from ADR Table A.
- `adr_class`: the label model number.
- `adr_packing_group`: I, II or III, where Table A assigns one.
- `adr_tunnel_code`: B, B1000C, B/D, B/E, C, C5000D, C/D, C/E, D, D/E or E.
  Leave it empty only if the route is known to avoid restricted tunnels.

The number and description of packages, total quantity, consignor and
consignee come from the shipment itself.

Not covered yet (needs a dedicated phase):

- Class 1 classification codes (e.g. 1.4S).
- Subsidiary hazards.
- Limited and excepted quantities.
- The "ENVIRONMENTALLY HAZARDOUS" mark.
- The 1.1.3.6 exemption calculation.
- The driver's instructions in writing (5.4.3).

Check the exact order and wording against the ADR edition in force.

## 2. Packing list

No convention prescribes its fields. Customs (for physical examination),
carriers and consignees expect the following, and Bordr prints all of it:

- Exporter and consignee: names, addresses, EORI / VAT.
- References: packing list number and date, commercial invoice number, CMR
  number, Incoterm, country of origin and destination, vehicle registration.
- **Per package:**
  - Package number (1…n).
  - Marks and numbers, as on the physical labels.
  - Package type (EUR pallet, pallet, crate, carton, drum, IBC, bag, other).
  - Contents: description and **HS code**.
  - Quantity (pcs).
  - Net and gross weight (kg).
  - Dimensions L × W × H (cm) and volume (m³).
- Totals: number of packages, quantity, net weight, gross weight, volume.
  These equal the invoice and CMR exactly, because the database computes them.
- The ADR line, where applicable.

**HS mapping per pallet.** Each package row carries the HS code of the goods it
contains. A shipment has one goods line today, so every package carries that
line's code. The schema keeps package contents separate from packages, so
multi-line shipments can add `shipment_package_contents (package_id, line_id,
quantity)` without changing the documents' structure (see *Next phases*).

## 3. Certificate of origin (non-preferential)

Under the Eurochambres guidelines, a certificate of origin certifies that goods
originated in a specific country or area.

- **Mandatory fields:**
  - Consignor.
  - Consignee.
  - Country of origin.
  - Item number, marks, numbers, number and kind of packages, and description of goods.
  - Quantity.
  - Place and date of issue, and the name, stamp and signature of the certifying authority.
- **Optional fields:** transport details and remarks.
- The certificate and its application must be completed identically, on
  210 × 297 mm forms.
- The origin may be stated as the European Union, an EU member state or a third
  country. Bordr uses the declared country of origin, the same as on the invoice.

**What Bordr produces.** Only the issuing authority (a chamber of commerce) can
issue the certificate, on its official form or e-CO system. Bordr therefore
produces the **application**:

- The standard boxes 1–7, completed from the shipment.
- The exporter's declaration of origin, for the signatory to sign.
- Box 8, **reserved for the issuing authority**, left blank.

The document says so in its header. It must never be presented as a
certificate.

Preferential origin (EUR.1 or a REX statement on origin, for reduced duty under
a trade agreement) is a separate regime and is not produced. The AI's
compliance notes flag when preferential origin could apply.

## 4. Database schema (migration `20261027000000_freight_documents.sql`)

### `carriers`: the workspace's address book

| Column | Type | Rule |
| --- | --- | --- |
| `id` | uuid PK | |
| `workspace_id` | uuid → `workspaces` | on delete cascade |
| `name` | text | 1–200, `is_clean_text`, unique per workspace (case-insensitive) |
| `address` | text | 1–400, each line `is_clean_text` |
| `country_code` | text | `^[A-Z]{2}$`, not `EU` |
| `created_at`, `updated_at` | timestamptz | |

- **RLS:** members can view, add and update; owners can delete.
- Carriers are upserted by name when a shipment is created, so the list fills
  itself.

### `shipments`: new columns (all nullable; older rows have none)

| Column | Type | Rule |
| --- | --- | --- |
| `carrier_id` | uuid → `carriers` | on delete set null |
| `carrier_name`, `carrier_address`, `carrier_country` | text | Snapshot, same rules as `carriers` |
| `vehicle_registration` | text | `^[A-Z0-9]+([ -][A-Z0-9]+)*$`, 2–15 |
| `trailer_registration` | text | Same as above, optional |
| `taking_over_place` | text | 1–200, `is_clean_text` |
| `taking_over_date` | date | |
| `delivery_place` | text | 1–200, `is_clean_text` |
| `sender_instructions` | text | ≤ 500, optional |
| `adr_un_number` | text | `^[0-9]{4}$`, not `0000` |
| `adr_shipping_name` | text | 1–200 |
| `adr_class` | text | One of 1.1–1.6, 2.1–2.3, 3, 4.1–4.3, 5.1, 5.2, 6.1, 6.2, 7, 8, 9 |
| `adr_packing_group` | text | I, II, III |
| `adr_tunnel_code` | text | ADR tunnel restriction codes |

Group constraints:

- **Transport is all-or-nothing:** carrier name, address and country, vehicle
  registration, both places and the date are set together.
- **ADR is all-or-nothing:** UN number, shipping name and class are set together.
- Shipments created before this phase keep working: they only ever have the
  invoice.

### `shipment_packages`: one row per pallet or package

| Column | Type | Rule |
| --- | --- | --- |
| `id` | uuid PK | |
| `shipment_id`, `workspace_id` | uuid | Composite FK → `shipments (id, workspace_id)`, on delete cascade |
| `position` | smallint | 1–99, unique per shipment |
| `package_type` | text | `eur_pallet`, `pallet`, `crate`, `carton`, `drum`, `ibc`, `bag`, `other` |
| `marks` | text | 1–60, `is_clean_text` |
| `quantity` | integer | 1–1,000,000 pcs |
| `net_weight_kg`, `gross_weight_kg` | numeric(12,3) | > 0, net ≤ gross |
| `length_cm` | integer | 1–1,400 (a semi-trailer is 13.6 m) |
| `width_cm` | integer | 1–260 |
| `height_cm` | integer | 1–300 |

- **RLS:** members can view. There is no direct insert, update or delete.
  Packages are written only by `create_shipment`, in the same transaction as
  their shipment, so an issued document can't be changed afterwards through the
  API.

### `public.create_shipment(shipment jsonb, packages jsonb) → uuid`

A security definer function that runs in one transaction:

1. Requires a session and membership of the target workspace.
2. Validates 1–99 packages, and the payload limits of 30,000 kg and 120 m³.
3. **Computes** `quantity`, `package_count`, `gross_weight_kg` and
   `net_weight_kg` from the packages.
4. Upserts the carrier and snapshots it onto the shipment.
5. Inserts the shipment. The Phase 6.5 trigger adds the exporter snapshot and
   the invoice number.
6. Inserts the packages and returns the shipment id.

## 5. Application layers

| Layer | File | Responsibility |
| --- | --- | --- |
| Shared schema | `services/customs/invoice.ts` | Shipment input (Zod), package and transport rules, Incoterm-derived clearance and freight terms, document data mapping |
| Server Action | `services/customs/actions.ts` | Auth, membership, profile check; AI classification and ADR plausibility review; `create_shipment` |
| Documents query | `services/shipments/actions.ts` | `getShipmentDocuments(id)` under RLS |
| PDF kit | `components/features/customs/pdf/` | Fonts, tokens, numbered-box primitives shared by all four documents |
| Documents | `CommercialInvoice`, `PackingList`, `CMRDocument`, `CertificateOfOrigin` | One component per document, built in the browser on click |
| UI | `/shipments/new`, dashboard Documents menu | Input (packages, transport, ADR), downloads |


## 6. Destinations

`DESTINATIONS` in `services/customs/constants.ts`: 50 countries, alphabetical.
They cover the 27 EU member states, the rest of geographic Europe, the
Caucasus states on the TIR routes (Armenia, Azerbaijan, Georgia), Türkiye,
the UK, the US and Canada.

- **Names.** One table, `services/customs/countries.ts`, feeds every picker and
  PDF. Destinations carry their ISO 3166-1 English short names, minus ISO's
  catalogue inversions (so "Moldova", not "Moldova, Republic of"). Kosovo
  uses the user-assigned code XK, as customs systems do.
- **Russia and Belarus** are left out. EU sanctions bar most road freight to
  them, and Bordr doesn't screen against sanctions lists.
- **Cross-border only.** The CMR Convention applies to carriage between two
  countries (Art. 1). The form and the Server Action refuse a destination
  equal to the exporter's country.
- **Inside the EU customs territory** (the member states plus Monaco):
  - The default CMR instruction reads "No customs formalities".
  - The AI is told there's no customs border, so duty is 0.0% for goods in
    free circulation.
- **Türkiye.** The EU–Türkiye customs union covers industrial goods only. The
  AI prompt names the A.TR movement certificate for them.
- **Other pickers.** The profile, origin and carrier country pickers keep the
  full ISO list: goods and carriers come from anywhere.
## 7. Next phases

- **Multi-line goods:**
  - `shipment_lines` (description, HS code, origin, quantity, unit price).
  - `shipment_package_contents (package_id, line_id, quantity)`.
  - AI classification per line.
  - Invoice and packing list with one row per line.
- **Sanctions screening** (consignee and goods) before destinations such as
  Russia or Belarus can be offered.
- **EU customs territory exceptions** (Canary Islands, Ceuta and Melilla,
  Heligoland and others): today every address in a member state is treated as
  inside the territory.
- **ADR completeness:** see the "not covered" list under Dangerous goods above.
- **e-CMR** (Additional Protocol, 2008) once carriers in the network accept it.
- **Preferential origin:** REX statement on origin, EUR.1.
- **Export declaration data:** MRN, customs office of exit.

## Sources

- [CMR Convention, consolidated text](https://jus.uio.no/english/services/library/treaties/07/7-02/cmr-consolidated.html), Art. 4–7.
- [ADR transport document particulars](https://www.bens-consulting.com/en/blog/312/adr-transport-document), a secondary source for 5.4.1.1.1; verify against the ADR edition in force.
- [Eurochambres guidelines on non-preferential origin](https://www.eurochambres.eu/wp-content/uploads/2022/11/Eurochambres-guidelines-on-rules-of-non-preferential-origin-%E2%80%93-export-of-goods-from-the-EU.pdf).
- [Landmark Global: the commercial invoice](https://landmarkglobal.com/eu/en/news-insights/the-commercial-invoice-how-to-complete-the-formalities/).
- [DB Schenker commercial invoice checklist](https://dbschenker.com/resource/blob/1828736/55d4268c30508e692f4e0933b3d2a57a/checklist-handelsfaktura-commercial-invoice-data.pdf).
