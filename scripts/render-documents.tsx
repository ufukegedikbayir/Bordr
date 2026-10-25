// Renders the four freight documents for the complex fixture to PDF files.
//
//   npx esbuild@0.25.10 scripts/render-documents.tsx --bundle --platform=node \
//     --format=esm --packages=external --jsx=automatic --tsconfig=tsconfig.json \
//     --outfile=.tmp-render/render.mjs && node .tmp-render/render.mjs <out-dir>
//
// Run from the project root (fonts load from ./public/fonts).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";

import { CMRDocument } from "@/components/features/customs/pdf/CMRDocument";
import { CertificateOfOrigin } from "@/components/features/customs/pdf/CertificateOfOrigin";
import { CommercialInvoice } from "@/components/features/customs/pdf/CommercialInvoice";
import { PackingList } from "@/components/features/customs/pdf/PackingList";

import { complexShipment } from "./fixtures/complex-shipment";

const outDir = process.argv[2] ?? ".tmp-render";
mkdirSync(outDir, { recursive: true });

const { transport } = complexShipment;
if (!transport) throw new Error("The fixture needs transport details for the CMR.");

const documents = {
  "commercial-invoice": <CommercialInvoice invoice={complexShipment.invoice} />,
  "packing-list": <PackingList data={complexShipment} />,
  cmr: <CMRDocument data={{ ...complexShipment, transport }} />,
  "certificate-of-origin": <CertificateOfOrigin data={complexShipment} />,
};

for (const [name, element] of Object.entries(documents)) {
  const file = join(outDir, `${name}.pdf`);
  writeFileSync(file, await renderToBuffer(element));
  console.log(`wrote ${file}`);
}
