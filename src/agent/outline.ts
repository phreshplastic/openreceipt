import { renderReceiptSvg } from "../receipt/render";
import type { ReceiptBlock, ReceiptDocument } from "../receipt/model";

/** Chrome caps a WebMCP tool result at 1.5K, so every string we hand back is budgeted. */
export const TOOL_OUTPUT_LIMIT = 1_500;

/** 203 dpi thermal heads put 8 dots in a millimetre. */
const DOTS_PER_MM = 8;

export function clampOutput(text: string, limit = TOOL_OUTPUT_LIMIT) {
  if (text.length <= limit) return { text, truncated: false };
  const marker = "\n… truncated";
  return { text: `${text.slice(0, limit - marker.length).trimEnd()}${marker}`, truncated: true };
}

function preview(value: string, max = 44) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** One line per block: position, kind, and just enough content to identify it. */
export function describeBlock(block: ReceiptBlock): string {
  if (block.type === "heading") return `heading   “${preview(block.text)}”`;
  if (block.type === "text") return `text      “${preview(block.text)}”`;
  if (block.type === "checklist") return `list      ${block.items.length} items · ${preview(block.items.map((item) => item.text).join(", "), 34)}`;
  if (block.type === "keyValue") return `facts     ${block.rows.length} rows · ${preview(block.rows.map((row) => row.label).join(", "), 34)}`;
  if (block.type === "table") return `table     ${block.rows.length}×${block.columns}`;
  if (block.type === "divider") return `rule      ${block.style}`;
  switch (block.kind) {
    case "checklistGroups": {
      const total = block.data.groups.reduce((sum, group) => sum + group.items.length, 0);
      const done = block.data.groups.reduce((sum, group) => sum + group.items.filter((item) => item.checked).length, 0);
      return `groups    “${preview(block.data.title, 26)}” · ${done}/${total} · ${block.data.groups.map((group) => group.name).join(", ")}`;
    }
    case "countdown": return `countdown ${block.data.days}d to “${preview(block.data.event, 24)}”`;
    case "weather": return `weather   ${preview(block.data.condition, 22)} · ${block.config.location.name}${block.stale ? " · stale" : ""}`;
    case "air": return `air       AQI ${block.data.aqi} · ${block.config.location.name}${block.stale ? " · stale" : ""}`;
    case "news": return `news      ${block.data.stories.length} stories${block.stale ? " · stale" : ""}`;
    case "markets": return `markets   base ${block.data.base}${block.stale ? " · stale" : ""}`;
    case "agenda": return `agenda    ${block.data.events.length} events · ${preview(block.data.date, 22)}`;
    case "habit": return `habits    ${block.data.rows.length} rows · ${preview(block.data.title, 22)}`;
    default: return `form      ${block.kind} (blank, write-in)`;
  }
}

export type ReceiptMeasurements = {
  widthDots: number;
  heightDots: number;
  paperLengthMm: number;
  blockCount: number;
  warnings: string[];
};

export function measureReceipt(document: ReceiptDocument): ReceiptMeasurements {
  const rendered = renderReceiptSvg(document);
  const paperLengthMm = Math.round(rendered.height / DOTS_PER_MM);
  const warnings: string[] = [];
  if (paperLengthMm > 400) warnings.push(`${paperLengthMm}mm of paper — longer than a forearm. Consider dropping a block.`);
  if (document.blocks.length > 14) warnings.push(`${document.blocks.length} blocks is a lot for one receipt.`);
  for (const block of document.blocks) {
    if (block.type === "text" && block.text.length > 600) warnings.push("A text block runs past 600 characters; split it or shorten it.");
    if (block.type === "catalog" && "stale" in block && block.stale) warnings.push(`The ${block.kind} block is showing saved data because a refresh failed.`);
  }
  return { widthDots: rendered.width, heightDots: rendered.height, paperLengthMm, blockCount: document.blocks.length, warnings: [...new Set(warnings)] };
}

export function outlineReceipt(document: ReceiptDocument, revision: number): string {
  const measured = measureReceipt(document);
  const header = `“${document.title}” · rev ${revision} · ${document.page.paperWidthMm}mm · ~${measured.paperLengthMm}mm of paper`;
  const lines = document.blocks.map((block, index) => `${String(index + 1).padStart(2)}  ${describeBlock(block)}`);
  const warnings = measured.warnings.length ? `\n! ${measured.warnings.join("\n! ")}` : "";
  return `${header}\n${lines.join("\n")}${warnings}`;
}

const columnsFor = (widthDots: number) => (widthDots >= 576 ? 42 : 31);

function wrap(text: string, columns: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line.length) line = word;
    else if (line.length + 1 + word.length <= columns) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [""];
}

const centre = (text: string, columns: number) => " ".repeat(Math.max(0, Math.floor((columns - text.length) / 2))) + text;

function blockToText(block: ReceiptBlock, columns: number): string[] {
  const box = (checked: boolean) => (checked ? "[x]" : "[ ]");
  if (block.type === "heading") {
    const body = wrap(block.level === "display" ? block.text.toUpperCase() : block.text, columns);
    return block.align === "center" ? body.map((line) => centre(line, columns)) : body;
  }
  if (block.type === "text") return block.align === "center" ? wrap(block.text, columns).map((line) => centre(line, columns)) : wrap(block.text, columns);
  if (block.type === "checklist") return block.items.flatMap((item) => wrap(`${box(item.checked)} ${item.text}`, columns));
  if (block.type === "keyValue") return block.rows.map((row) => `${row.label} ${".".repeat(Math.max(1, columns - row.label.length - row.value.length - 2))} ${row.value}`);
  if (block.type === "table") return block.rows.map((row) => row.cells.join("  |  "));
  if (block.type === "divider") return [(block.style === "dashed" ? "-" : "=").repeat(columns)];
  switch (block.kind) {
    case "checklistGroups":
      return [
        ...wrap(block.data.title, columns),
        ...block.data.groups.flatMap((group) => [`— ${group.name.toUpperCase()} —`, ...group.items.flatMap((item) => wrap(`${box(item.checked)} ${item.text}`, columns))]),
      ];
    case "countdown": return [`${block.data.days} DAYS TO GO`, ...wrap(`${block.data.event} · ${block.data.date}`, columns)];
    case "weather": return [`${block.config.location.name}: ${block.data.condition}`, ...block.data.points.map((point) => `  ${point.label} ${Math.round(point.temperature)}°`)];
    case "air": return [`Air ${block.data.aqi} · ${block.data.label}`, ...wrap(block.data.outlook, columns)];
    case "news": return block.data.stories.flatMap((story) => wrap(`• ${story.title}`, columns));
    case "markets": return block.data.rows.map((row) => `${row.symbol} ${row.value.toFixed(3)} ${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}%`);
    case "agenda": return [block.data.date, ...block.data.events.map((event) => `${event.start}${event.end ? `–${event.end}` : ""}  ${event.title}`)];
    case "habit": return [block.data.title, ...block.data.rows.map((row) => `${row.label.padEnd(14).slice(0, 14)} ${row.values.map((value) => (value === 2 ? "●" : value === 1 ? "○" : "·")).join(" ")}`)];
    default: return [`[ blank ${block.kind} form ]`];
  }
}

/** A plain-text stand-in for the printed paper, so an agent can check its own work. */
export function renderReceiptText(document: ReceiptDocument): string {
  const columns = columnsFor(document.page.printableWidthDots);
  return document.blocks.flatMap((block) => [...blockToText(block, columns), ""]).join("\n").trimEnd();
}

export function diffReceipts(before: ReceiptDocument, after: ReceiptDocument): string[] {
  const previous = new Map(before.blocks.map((block) => [block.id, JSON.stringify(block)]));
  const currentIds = new Set(after.blocks.map((block) => block.id));
  const changes: string[] = [];
  if (before.title !== after.title) changes.push(`title → “${after.title}”`);
  after.blocks.forEach((block, index) => {
    if (!previous.has(block.id)) changes.push(`+ ${index + 1} ${describeBlock(block)}`);
    else if (previous.get(block.id) !== JSON.stringify(block)) changes.push(`~ ${index + 1} ${describeBlock(block)}`);
  });
  for (const block of before.blocks) if (!currentIds.has(block.id)) changes.push(`- ${describeBlock(block)}`);
  return changes;
}
