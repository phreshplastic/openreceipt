// Renders one receipt containing every insertable block, at both paper widths, for a design pass.
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { compileDraftBlocks, type DraftBlock } from "../src/agent/schema";
import { createDefaultDocument } from "../src/receipt/templates";
import { receiptDocumentSchema } from "../src/receipt/model";
import { renderReceiptSvg } from "../src/receipt/render";

const blocks: DraftBlock[] = [
  { type: "heading", text: "Every block", size: "display" },
  { type: "text", text: "One of each, to check the rhythm on a long roll." },
  { type: "countdown", event: "Wheels up", date: "Thursday", days: 3, milestones: ["Booked", "Packed", "Go"] },
  { type: "facts", rows: [{ label: "Flight", value: "TP 204", emphasis: true }, { label: "Seat", value: "14A" }] },
  { type: "weather", city: "Lisbon" },
  { type: "air", city: "Lisbon" },
  { type: "surf", city: "Ericeira" },
  { type: "markets" },
  { type: "news" },
  { type: "quakes" },
  { type: "games", league: "Soccer" },
  { type: "rule", style: "dashed" },
  { type: "groups", title: "Packing", groups: [{ name: "Carry-on", items: ["Passport", { text: "Charger", checked: true }] }] },
  { type: "list", items: ["Water the plants", "Bins out"] },
  { type: "table", header: ["Night", "Meal"], rows: [["Mon", "Soup"], ["Tue", "Fish"]] },
  { type: "agenda", events: [{ start: "8:20", title: "Flight TP 204", detail: "Gate 22" }] },
  { type: "habits", habits: ["Water", "Walk"] },
  { type: "form", form: "mealPlan" },
  { type: "form", form: "meetingNotes" },
  { type: "form", form: "workoutLog" },
  { type: "form", form: "dailyPlan" },
  { type: "form", form: "packingList" },
  { type: "form", form: "weatherJournal" },
];

const compiled = await compileDraftBlocks(blocks);
const out = process.argv[2] ?? "/tmp/design";

for (const [width, padding] of [[576, 28], [420, 22]] as const) {
  const document = receiptDocumentSchema.parse({
    ...createDefaultDocument(),
    title: "Every block",
    page: { paperWidthMm: width === 576 ? 80 : 58, printableWidthDots: width, paddingDots: padding },
    blocks: compiled,
  });
  const rendered = renderReceiptSvg(document);
  writeFileSync(`${out}-${width}.svg`, rendered.svg);
  const png = new Resvg(rendered.svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  writeFileSync(`${out}-${width}.png`, png);
  console.log(`${width} dots → ${rendered.height} tall (${Math.round(rendered.height / 8)}mm), ${png.length} bytes`);
}
