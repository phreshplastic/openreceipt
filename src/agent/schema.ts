import { z } from "zod";
import { createCatalogBlock, type CatalogDependencies, type CatalogInsertConfig } from "../block-library";
import { createId, type CatalogBlockKind, type ReceiptBlock } from "../receipt/model";

/**
 * The agent-facing block vocabulary.
 *
 * Deliberately flat and id-free: an agent writing from a sentence should never have to
 * invent a UUID, a `definitionVersion`, or a full style record. `compileDraftBlocks`
 * lowers these into the strict `receiptBlockSchema` shapes the document actually stores.
 */

const align = z.enum(["left", "center", "right"]);
const itemSchema = z.union([
  z.string().min(1).max(160),
  z.object({ text: z.string().min(1).max(160), checked: z.boolean().optional() }),
]);

const writeInForms = ["dailyPlan", "packingList", "mealPlan", "meetingNotes", "workoutLog", "weatherJournal", "groupedChecklist"] as const;

export const draftBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().min(1).max(240), size: z.enum(["display", "heading", "section"]).optional(), align: align.optional() }),
  z.object({ type: z.literal("text"), text: z.string().min(1).max(4_000), size: z.enum(["small", "body", "large"]).optional(), align: align.optional(), emphasis: z.boolean().optional() }),
  z.object({ type: z.literal("list"), items: z.array(itemSchema).min(1).max(40) }),
  z.object({ type: z.literal("facts"), rows: z.array(z.object({ label: z.string().min(1).max(160), value: z.string().max(300), emphasis: z.boolean().optional() })).min(1).max(40), dividers: z.boolean().optional() }),
  z.object({ type: z.literal("table"), header: z.array(z.string().max(300)).min(2).max(3).optional(), rows: z.array(z.array(z.string().max(300)).min(2).max(3)).min(1).max(40) }),
  z.object({ type: z.literal("rule"), style: z.enum(["solid", "dashed"]).optional() }),
  z.object({ type: z.literal("groups"), title: z.string().min(1).max(120), note: z.string().max(60).optional(), groups: z.array(z.object({ name: z.string().min(1).max(40), items: z.array(itemSchema).min(1).max(20) })).min(1).max(6) }),
  z.object({ type: z.literal("countdown"), event: z.string().min(1).max(60), date: z.string().min(1).max(60), days: z.number().int().min(0).max(9_999), label: z.string().max(40).optional(), milestones: z.array(z.union([z.string().min(1).max(20), z.object({ label: z.string().min(1).max(20), complete: z.boolean().optional() })])).max(5).optional() }),
  z.object({ type: z.literal("weather"), city: z.string().min(1).max(160), unit: z.enum(["fahrenheit", "celsius"]).optional() }),
  z.object({ type: z.literal("air"), city: z.string().min(1).max(160) }),
  z.object({ type: z.literal("news") }),
  z.object({ type: z.literal("markets") }),
  z.object({ type: z.literal("agenda"), date: z.string().max(100).optional(), events: z.array(z.object({ start: z.string().min(1).max(40), end: z.string().max(40).optional(), title: z.string().min(1).max(300), detail: z.string().max(300).optional() })).min(1).max(16) }),
  z.object({ type: z.literal("habits"), title: z.string().max(120).optional(), period: z.string().max(120).optional(), habits: z.array(z.string().min(1).max(80)).min(1).max(10) }),
  z.object({ type: z.literal("form"), form: z.enum(writeInForms) }),
]);

export type DraftBlock = z.infer<typeof draftBlockSchema>;
export type DraftBlockType = DraftBlock["type"];

function normalizeItems(items: z.infer<typeof itemSchema>[]) {
  return items.map((item) => (typeof item === "string" ? { text: item, checked: false } : { text: item.text, checked: item.checked ?? false }));
}

async function catalog(kind: CatalogBlockKind, config: CatalogInsertConfig, dependencies?: CatalogDependencies) {
  return createCatalogBlock(kind, config, dependencies);
}

/** Lowers one agent-facing block into the stored representation. Live blocks fetch here. */
export async function compileDraftBlock(block: DraftBlock, dependencies?: CatalogDependencies): Promise<ReceiptBlock> {
  switch (block.type) {
    case "heading":
      return { id: createId(), type: "heading", text: block.text, level: block.size ?? "heading", weight: "bold", italic: false, underline: false, align: block.align ?? "left" };
    case "text":
      return { id: createId(), type: "text", text: block.text, size: block.size ?? "body", weight: block.emphasis ? "medium" : "regular", italic: false, underline: false, align: block.align ?? "left" };
    case "list":
      return { id: createId(), type: "checklist", items: normalizeItems(block.items).map((item) => ({ id: createId(), text: item.text, checked: item.checked })) };
    case "facts":
      return { id: createId(), type: "keyValue", dividers: block.dividers ?? false, rows: block.rows.map((row) => ({ id: createId(), label: row.label, value: row.value, emphasis: row.emphasis ?? false })) };
    case "table": {
      const rows = block.header ? [block.header, ...block.rows] : block.rows;
      const columns = Math.min(3, Math.max(2, rows[0]?.length ?? 2)) as 2 | 3;
      return { id: createId(), type: "table", columns, header: Boolean(block.header), rows: rows.map((cells) => ({ id: createId(), cells: cells.slice(0, columns) })) };
    }
    case "rule":
      return { id: createId(), type: "divider", style: block.style ?? "solid" };
    case "groups":
      return catalog("checklistGroups", { title: block.title, note: block.note, groups: block.groups.map((group) => ({ name: group.name, items: normalizeItems(group.items) })) }, dependencies);
    case "countdown":
      return catalog("countdown", {
        event: block.event, date: block.date, days: block.days, label: block.label,
        milestones: block.milestones?.map((milestone) => (typeof milestone === "string" ? { label: milestone } : milestone)),
      }, dependencies);
    case "weather":
      return catalog("weather", { city: block.city, unit: block.unit ?? "fahrenheit" }, dependencies);
    case "air":
      return catalog("air", { city: block.city }, dependencies);
    case "news":
      return catalog("news", undefined, dependencies);
    case "markets":
      return catalog("markets", undefined, dependencies);
    case "agenda": {
      const built = await catalog("agenda", undefined, dependencies);
      if (built.kind !== "agenda") throw new Error("Agenda block could not be created.");
      return { ...built, data: { date: block.date ?? built.data.date, events: block.events.map((event) => ({ id: createId(), ...event })) } };
    }
    case "habits": {
      const built = await catalog("habit", undefined, dependencies);
      if (built.kind !== "habit") throw new Error("Habit block could not be created.");
      return { ...built, data: {
        title: block.title ?? built.data.title,
        period: block.period ?? built.data.period,
        rows: block.habits.map((label) => ({ id: createId(), label, values: [1, 1, 1, 1, 1, 1, 1] as Array<0 | 1 | 2> })),
      } };
    }
    case "form":
      return catalog(block.form, undefined, dependencies);
  }
}

export async function compileDraftBlocks(blocks: DraftBlock[], dependencies?: CatalogDependencies): Promise<ReceiptBlock[]> {
  const compiled: ReceiptBlock[] = [];
  for (const block of blocks) compiled.push(await compileDraftBlock(block, dependencies));
  return compiled;
}
