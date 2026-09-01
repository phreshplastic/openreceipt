import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { receiptDocumentV2Schema } from "../src/receipt/model.ts";

const target = resolve("bridge/src/petes_printer_bridge/receipt-document-v2.schema.json");
const schema = z.toJSONSchema(receiptDocumentV2Schema, { target: "draft-2020-12" });
schema.properties.page.allOf = [
  {
    if: { properties: { paperWidthMm: { const: 80 } }, required: ["paperWidthMm"] },
    then: { properties: { printableWidthDots: { const: 576 } } },
  },
  {
    if: { properties: { paperWidthMm: { const: 58 } }, required: ["paperWidthMm"] },
    then: { properties: { printableWidthDots: { const: 420 } } },
  },
];
await writeFile(target, `${JSON.stringify(schema, null, 2)}\n`, { mode: 0o644 });
console.log(`Generated ${target}`);
