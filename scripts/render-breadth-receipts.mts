/**
 * Renders the four receipts the film's breadth beat shows — one per noun the
 * voiceover names: a grocery list, a morning brief, a reminder, meeting notes.
 *
 * These are not mock-ups. The block specs below are exactly what was passed to
 * the product's own `draft_receipt` tool over WebMCP, and they are compiled
 * here through the same `compileDraftBlocks` the tool calls and rendered by the
 * same `renderReceiptSvg` the app and the printer use. Running this script
 * reproduces the assets from source instead of leaving four opaque PNGs in the
 * repo with no way to regenerate them.
 *
 *   node --import tsx scripts/render-breadth-receipts.mts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { compileDraftBlocks, type DraftBlock } from "../src/agent/schema";
import { renderReceiptSvg } from "../src/receipt/render";
import { createId } from "../src/receipt/model";

const OUT = "video/edit/public/generated";

/** The wordmark the app keeps at the head of every draft. */
const sign = () => ({
  id: createId(),
  type: "catalog" as const,
  kind: "logo" as const,
  definitionVersion: 1,
  data: { style: "owners-printer-western", primary: "PETE’S", secondary: "PRINTER", size: "medium" },
});

const receipts: { file: string; title: string; blocks: DraftBlock[] }[] = [
  {
    file: "breadth-grocery",
    title: "Grocery run",
    blocks: [
      { type: "heading", text: "Grocery run", size: "display" },
      { type: "text", text: "Saturday · corner market", size: "small" },
      { type: "rule", style: "solid" },
      {
        type: "groups",
        title: "Shopping",
        note: "By aisle",
        groups: [
          { name: "Produce", items: ["Lemons", "Baby spinach", "Avocados", "Flat parsley"] },
          { name: "Dairy", items: ["Whole milk", "Greek yoghurt", "Parmesan"] },
          { name: "Pantry", items: ["Olive oil", "Arborio rice", "Tinned tomatoes"] },
          { name: "Freezer", items: ["Peas", "Ice"] },
        ],
      },
    ],
  },
  {
    file: "breadth-morning",
    title: "Morning brief",
    blocks: [
      { type: "heading", text: "Morning brief", size: "display" },
      { type: "text", text: "Thursday · at the kitchen table", size: "small" },
      { type: "rule", style: "solid" },
      {
        type: "agenda",
        date: "Today",
        events: [
          { start: "8:40", title: "Coffee, then the lab" },
          { start: "13:00", title: "Walk the river path" },
          { start: "18:30", title: "Dinner with Sam", detail: "Cornelia St" },
        ],
      },
      { type: "rule", style: "solid" },
      { type: "habits", title: "This week", period: "Mon – Sun", habits: ["Ran", "Stretched", "In bed by ten"] },
    ],
  },
  {
    file: "breadth-reminder",
    title: "Reminder",
    blocks: [
      { type: "heading", text: "Don't forget", size: "display" },
      { type: "text", text: "Before you leave on Friday", size: "small" },
      { type: "rule", style: "solid" },
      { type: "text", text: "Return the library books.", size: "large", emphasis: true },
      { type: "rule", style: "dashed" },
      { type: "list", items: ["Passport in the drawer", "Water the plants", "Bins out"] },
    ],
  },
  {
    file: "breadth-meeting",
    title: "Meeting prep",
    blocks: [
      { type: "heading", text: "Meeting prep", size: "display" },
      { type: "text", text: "Tuesday · 10:00 · with Dana", size: "small" },
      { type: "rule", style: "solid" },
      {
        type: "facts",
        rows: [
          { label: "Who", value: "Dana, Priya" },
          { label: "When", value: "Tue · 10:00" },
          { label: "Deciding", value: "Launch date" },
        ],
      },
      { type: "rule", style: "solid" },
      { type: "list", items: ["Q3 numbers walkthrough", "Open bugs worth holding for", "Pick the launch date"] },
      { type: "form", form: "meetingNotes" },
    ],
  },
];

for (const receipt of receipts) {
  const blocks = await compileDraftBlocks(receipt.blocks);
  const document = {
    schemaVersion: 2 as const,
    id: createId(),
    title: receipt.title,
    page: { paperWidthMm: 80 as const, printableWidthDots: 576 as const, paddingDots: 28 },
    blocks: [sign(), ...blocks],
  };

  const rendered = renderReceiptSvg(document as never);
  const base = resolve(`${OUT}/${receipt.file}`);
  await mkdir(dirname(base), { recursive: true });
  await writeFile(`${base}.svg`, rendered.svg);
  await writeFile(
    `${base}.png`,
    new Resvg(rendered.svg, { fitTo: { mode: "width", value: rendered.width } }).render().asPng(),
  );
  process.stdout.write(`${receipt.title}: ${rendered.width} x ${rendered.height} dots\n`);
}
