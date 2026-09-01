import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { samplePrototypeData } from "../blocks/fixtures";
import type { CatalogDependencies } from "../block-library";
import { ReceiptController, createReceiptState } from "../receipt/controller";
import { receiptDocumentSchema } from "../receipt/model";
import { createDefaultDocument } from "../receipt/templates";
import { TOOL_OUTPUT_LIMIT, clampOutput, measureReceipt, outlineReceipt } from "./outline";
import { recipes } from "./recipes";
import { compileDraftBlocks, type DraftBlock } from "./schema";
import { createAgentTools, runAgentTool, type AgentBackend } from "./tools";
import { blockVocabulary, collectionFields } from "./vocabulary";

const now = new Date("2026-08-31T12:00:00.000Z");
const dependencies: CatalogDependencies = {
  geocode: vi.fn(async () => ({ name: "Lisbon, Portugal", latitude: 38.72, longitude: -9.14, timezone: "Europe/Lisbon" })),
  weather: vi.fn(async () => structuredClone(samplePrototypeData.weather)),
  air: vi.fn(async () => structuredClone(samplePrototypeData.air)),
  markets: vi.fn(async () => structuredClone(samplePrototypeData.markets)),
  news: vi.fn(async () => structuredClone(samplePrototypeData.news)),
  surf: vi.fn(async () => structuredClone(samplePrototypeData.surf)),
  games: vi.fn(async () => structuredClone(samplePrototypeData.games)),
  earthquakes: vi.fn(async () => structuredClone(samplePrototypeData.earthquakes)),
  now: () => now,
};

/** One of every agent-facing block, which doubles as the compiler's coverage check. */
const everyBlock: DraftBlock[] = [
  { type: "heading", text: "Lisbon, four days", size: "display" },
  { type: "text", text: "Wheels up Thursday at 8:20." },
  { type: "list", items: ["Passport", { text: "Charger", checked: true }] },
  { type: "facts", rows: [{ label: "Flight", value: "TP 204", emphasis: true }, { label: "Seat", value: "14A" }] },
  { type: "table", header: ["Night", "Meal"], rows: [["Mon", "Soup"], ["Tue", "Fish"]] },
  { type: "rule", style: "dashed" },
  { type: "groups", title: "Packing", note: "Thu", groups: [{ name: "Carry-on", items: ["Passport", { text: "Headphones", checked: true }] }, { name: "Clothes", items: ["Rain shell"] }] },
  { type: "countdown", event: "Wheels up", date: "September 3", days: 3, milestones: ["Booked", { label: "Packed", complete: false }] },
  { type: "weather", city: "Lisbon" },
  { type: "air", city: "Lisbon" },
  { type: "news" },
  { type: "markets" },
  { type: "surf", city: "Ericeira" },
  { type: "games", league: "Soccer" },
  { type: "quakes" },
  { type: "agenda", events: [{ start: "8:20", title: "Flight TP 204", detail: "Gate 22" }] },
  { type: "habits", habits: ["Water", "Walk"] },
  { type: "form", form: "meetingNotes" },
];

function makeBackend() {
  const controller = new ReceiptController(createReceiptState(createDefaultDocument(), 0));
  const requestPrint = vi.fn(async (revision: number) => ({ status: "succeeded" as const, revision, message: "Printed." }));
  const backend: AgentBackend = {
    getState: () => controller.state,
    commit: (expectedRevision, document) => controller.commitPrepared(expectedRevision, document),
    requestPrint,
    undo: () => controller.undo(),
    status: () => ({ editorUrl: "http://127.0.0.1:8731/app", configured: true, bridgeOnline: true, printPolicy: "confirm" as const }),
    dependencies,
  };
  return { backend, controller, requestPrint, tools: new Map(createAgentTools(backend).map((tool) => [tool.name, tool])) };
}

const call = (harness: ReturnType<typeof makeBackend>, name: string, input?: unknown) =>
  runAgentTool(harness.tools.get(name)!, input, harness.backend);

describe("agent block compiler", () => {
  it("lowers every agent-facing block into a valid receipt document", async () => {
    const blocks = await compileDraftBlocks(everyBlock, dependencies);
    expect(blocks).toHaveLength(everyBlock.length);
    const document = receiptDocumentSchema.parse({ ...createDefaultDocument(), blocks });
    expect(measureReceipt(document).heightDots).toBeGreaterThan(0);
    expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
  });

  it("covers every vocabulary entry", () => {
    expect(new Set(everyBlock.map((block) => block.type))).toEqual(new Set(blockVocabulary.map((entry) => entry.type)));
  });
});

describe("recipes", () => {
  it("only reference blocks the compiler knows", () => {
    const known = new Set(blockVocabulary.map((entry) => entry.type));
    for (const recipe of recipes) for (const block of recipe.blocks) expect(known).toContain(block);
  });

  it("suggests trip prep from a travel sentence", async () => {
    const harness = makeBackend();
    const result = await call(harness, "list_receipt_recipes", { situation: "I'm flying to Lisbon on an international flight Thursday" });
    expect(result.data.matched).toContain("travel_prep");
  });
});

describe("WebMCP limits", () => {
  const harness = makeBackend();
  const tools = createAgentTools(harness.backend);

  it("keeps names and descriptions inside Chrome's caps", () => {
    for (const tool of tools) {
      expect(tool.name.length, tool.name).toBeLessThanOrEqual(30);
      expect(tool.description.length, tool.name).toBeLessThanOrEqual(500);
    }
  });

  it("keeps a large receipt's outline inside the 1.5K result cap", async () => {
    const blocks = await compileDraftBlocks([...everyBlock, ...everyBlock], dependencies);
    const document = receiptDocumentSchema.parse({ ...createDefaultDocument(), blocks });
    expect(clampOutput(outlineReceipt(document, 3)).text.length).toBeLessThanOrEqual(TOOL_OUTPUT_LIMIT);
  });
});

describe("drafting and editing", () => {
  it("drafts a whole receipt in one call and reports the paper length", async () => {
    const harness = makeBackend();
    const result = await call(harness, "draft_receipt", { title: "Lisbon, four days", blocks: everyBlock });
    expect(result.data.status).toBe("updated");
    expect(result.data.revision).toBe(1);
    expect(result.data.paperLengthMm).toBeGreaterThan(0);
    expect(harness.controller.state.document.title).toBe("Lisbon, four days");
  });

  it("leaves the receipt untouched on a dry run", async () => {
    const harness = makeBackend();
    const result = await call(harness, "draft_receipt", { title: "Preview only", blocks: [{ type: "text", text: "Hello" }], dryRun: true });
    expect(result.data.status).toBe("dry_run");
    expect(harness.controller.state.revision).toBe(0);
  });

  it("checks a single item by name without rewriting the block", async () => {
    const harness = makeBackend();
    await call(harness, "draft_receipt", {
      title: "Packing",
      blocks: [{ type: "groups", title: "Packing", groups: [{ name: "Carry-on", items: ["Passport", "Charger"] }] }],
    });
    const before = harness.controller.state.document.blocks[0];
    await call(harness, "edit_receipt", { operations: [{ op: "checkItem", at: 1, item: "passport" }] });
    const after = harness.controller.state.document.blocks[0];
    expect(after.id).toBe(before.id);
    if (after.type !== "catalog" || after.kind !== "checklistGroups") throw new Error("expected a grouped list");
    expect(after.data.groups[0].items).toEqual([{ text: "Passport", checked: true }, { text: "Charger", checked: false }]);
  });

  it("refuses a stale revision instead of overwriting a human edit", async () => {
    const harness = makeBackend();
    await call(harness, "draft_receipt", { title: "First", blocks: [{ type: "text", text: "One" }] });
    const result = await call(harness, "edit_receipt", { expectedRevision: 0, operations: [{ op: "setTitle", title: "Second" }] });
    expect(result.data.status).toBe("stale");
    expect(result.data.currentRevision).toBe(1);
    expect(harness.controller.state.document.title).toBe("First");
  });

  it("reports schema problems as fixable input errors", async () => {
    const harness = makeBackend();
    const result = await call(harness, "edit_receipt", { operations: [{ op: "remove", at: 0 }] });
    expect(result.data.status).toBe("invalid_input");
    expect(result.isError).toBe(true);
  });

  it("undoes its own last change", async () => {
    const harness = makeBackend();
    await call(harness, "draft_receipt", { title: "Drafted", blocks: [{ type: "text", text: "One" }] });
    await call(harness, "undo_agent_edit");
    expect(harness.controller.state.document.title).not.toBe("Drafted");
  });
});

describe("printing", () => {
  it("will not print a revision that is no longer on screen", async () => {
    const harness = makeBackend();
    const result = await call(harness, "request_receipt_print", { expectedRevision: 7 });
    expect(result.data.status).toBe("stale");
    expect(harness.requestPrint).not.toHaveBeenCalled();
  });

  it("prints the exact visible revision", async () => {
    const harness = makeBackend();
    const result = await call(harness, "request_receipt_print", { expectedRevision: 0, reason: "Asked for it" });
    expect(result.data.status).toBe("succeeded");
    expect(harness.requestPrint).toHaveBeenCalledWith(0, "Asked for it", undefined);
  });
});

describe("granular edits across every collection", () => {
  const editTool = () => createAgentTools(makeBackend().backend).find((tool) => tool.name === "edit_receipt")!;

  it("keeps Chrome's tool description under its cap after widening edit_receipt", () => {
    const edit = editTool();
    expect(edit.description.length).toBeLessThanOrEqual(500);
  });

  // This schema is shipped to every agent on every turn, so its growth should be a
  // deliberate decision. Bump this only alongside a reason for the extra context cost.
  it("keeps the edit schema small enough to ship to every agent", () => {
    expect(JSON.stringify(z.toJSONSchema(editTool().inputSchema)).length).toBeLessThanOrEqual(16_000);
  });

  it("names every collection's fields to the agent", () => {
    expect(collectionFields.meetingNotes).toEqual(["owner", "due"]);
    expect(collectionFields.workoutLog).toEqual(["sets", "reps", "load"]);
    expect(collectionFields.keyValue).toEqual(["value", "emphasis"]);
  });
});
