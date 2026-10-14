import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileDraftBlocks, type DraftBlock } from "../src/agent/schema";
import { createDefaultDocument } from "../src/receipt/templates";
import { renderCanonical } from "../mcp/render";

const destination = resolve(process.argv[2] ?? "test-results/receipt-layouts");
mkdirSync(destination, { recursive: true });
const examples: Record<string, DraftBlock[]> = {
  shopping: [{ type: "logo", name: "PETE’S", tagline: "PRINTER" }, { type: "heading", text: "Shopping" }, { type: "groups", title: "Dinner and the week ahead", groups: [{ name: "Produce", items: ["Apples", "Baby spinach and fresh herbs for tomorrow’s dinner", { text: "Lemons", checked: true }] }, { name: "Pantry", items: ["Olive oil", "Wholegrain bread", "Coffee beans"] }] }],
  reminder: [{ type: "heading", text: "Before you leave the house tomorrow morning", size: "display" }, { type: "text", text: "Take the library books back on the way to work.", size: "large" }, { type: "rule" }, { type: "list", items: ["Books by the front door", "Reusable shopping bags", "The charger with the long USB-C cable"] }],
  morning: [{ type: "heading", text: "Tuesday morning" }, { type: "text", text: "A quiet start. Leave a little space between appointments." }, { type: "facts", rows: [{ label: "First appointment and location", value: "9:30 · Coffee at the corner café", emphasis: true }, { label: "Remember", value: "Pick up the parcel before the shop closes" }] }, { type: "table", header: ["Time", "Plan", "Bring"], rows: [["9:30", "A long project catch-up with the team", "Notebook and charger"], ["12:30", "Lunch and a walk", "Rain jacket"], ["18:00", "Dinner at home", "Groceries"]] }],
  packing: [{ type: "heading", text: "Four days away" }, { type: "groups", title: "Pack once, check twice", note: "Carry-on only", groups: [{ name: "Carry-on", items: ["Passport", "Phone charger and the travel adapter", "Headphones", "Medication in its original packaging"] }, { name: "Clothes", items: ["Four shirts", "A warm layer for the evening", "Rain shell"] }, { name: "Before the door", items: ["Keys", "Wallet", "Water bottle"] }] }],
};
let body = "";
for (const width of [576, 420] as const) {
  for (const [name, blocks] of Object.entries(examples)) {
    const document = createDefaultDocument();
    document.title = name;
    document.page = { printableWidthDots: width, paperWidthMm: width === 576 ? 80 : 58, paddingDots: width === 576 ? 28 : 22 };
    document.blocks = await compileDraftBlocks(blocks);
    const rendered = renderCanonical(document);
    writeFileSync(resolve(destination, `${name}-${width}.png`), Buffer.from(rendered.png, "base64"));
    writeFileSync(resolve(destination, `${name}-${width}.json`), JSON.stringify(document, null, 2));
    body += `<figure><figcaption>${name} · ${document.page.paperWidthMm} mm</figcaption><img src="${name}-${width}.png" width="${width / 2}" alt="${name}"></figure>`;
  }
}
writeFileSync(resolve(destination, "index.html"), `<!doctype html><meta charset="utf-8"><title>Receipt layout checks</title><style>body{background:#e8e6e0;font:15px system-ui;padding:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;align-items:start}figure{margin:0}figcaption{margin:0 0 12px}img{display:block;background:white;max-width:100%;height:auto;box-shadow:0 2px 8px #0002}</style><main>${body}</main>`);
console.log(destination);
