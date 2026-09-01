import { z } from "zod";
import type { CatalogDependencies } from "../block-library";
import type { PrintResult } from "../printing/coordinator";
import { receiptDocumentSchema, type ReceiptBlock, type ReceiptDocument } from "../receipt/model";
import { addChild, blockLabel, collectionFor, removeChild, viewCollection, writeChild } from "../receipt/collections";
import type { ReceiptState } from "../receipt/controller";
import { refreshCatalogBlock } from "../block-library";
import { clampOutput, describeBlock, diffReceipts, measureReceipt, outlineReceipt, renderReceiptText } from "./outline";
import { recipes, suggestRecipes } from "./recipes";
import { blockVocabulary, collectionFields } from "./vocabulary";
import { compileDraftBlock, compileDraftBlocks, draftBlockSchema } from "./schema";

export type AgentPhase = "reading" | "drafting" | "editing" | "waitingForApproval" | "printing" | "complete" | "error";
export type AgentActivity = { phase: AgentPhase; message: string; blockIds?: string[] };

export type AgentAppStatus = {
  editorUrl: string;
  configured: boolean;
  bridgeOnline: boolean;
  printPolicy: "confirm" | "approved" | "autonomous";
  syncStatus?: string;
  lastPrint?: { status: string; message: string };
};

export type AgentBackend = {
  getState(signal?: AbortSignal): ReceiptState | Promise<ReceiptState>;
  commit(expectedRevision: number, document: ReceiptDocument, summary: string, signal?: AbortSignal): ReceiptState | Promise<ReceiptState>;
  requestPrint(expectedRevision: number, reason: string | undefined, signal?: AbortSignal): Promise<PrintResult>;
  status(signal?: AbortSignal): AgentAppStatus | Promise<AgentAppStatus>;
  undo?(): ReceiptState | Promise<ReceiptState | undefined> | undefined;
  focusPreview?(): void;
  openEditor?(highlight?: string[]): void;
  dependencies?: CatalogDependencies;
  onActivity?(activity: AgentActivity): void;
};

export type AgentToolResult = { text: string; data: Record<string, unknown>; isError?: boolean };

export type AgentToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  readOnly: boolean;
  /** Set where a result can carry text fetched from a third-party feed. */
  untrustedContent: boolean;
  execute(input: unknown, signal?: AbortSignal): Promise<AgentToolResult>;
};

class StaleRevision extends Error {
  constructor(readonly expected: number, readonly current: number) {
    super(`Receipt revision ${expected} is stale; the receipt is now at revision ${current}. Read it again before editing.`);
    this.name = "StaleRevisionError";
  }
}

const revision = z.number().int().min(0);
const position = z.number().int().min(1).describe("1-based position of a block, as shown by get_receipt");
const itemRef = z.union([z.number().int().min(1), z.string().min(1).max(160)]).describe("1-based position, or text to match");

const emptyInput = z.object({}).strict();
const groupRef = z.union([z.number().int().min(1), z.string().max(40)]).describe("Which group, section or meal — position or name");
const childFields = z.record(z.string().max(24), z.union([z.string().max(300), z.number(), z.boolean()]))
  .describe("Other attributes on the line; list_receipt_blocks names them per block");

const editOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setTitle"), title: z.string().min(1).max(160) }).strict(),
  z.object({ op: z.literal("add"), block: draftBlockSchema, at: position.optional() }).strict(),
  z.object({ op: z.literal("replace"), at: position, block: draftBlockSchema }).strict(),
  z.object({ op: z.literal("remove"), at: position }).strict(),
  z.object({ op: z.literal("move"), at: position, to: position }).strict(),
  z.object({ op: z.literal("refresh"), at: position }).strict(),
  z.object({ op: z.literal("addItem"), at: position, group: groupRef.optional(), text: z.string().min(1).max(300), checked: z.boolean().optional(), fields: childFields.optional() }).strict(),
  z.object({ op: z.literal("setItem"), at: position, item: itemRef, text: z.string().min(1).max(300).optional(), checked: z.boolean().optional(), fields: childFields.optional() }).strict(),
  z.object({ op: z.literal("checkItem"), at: position, item: itemRef, checked: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("removeItem"), at: position, item: itemRef }).strict(),
]);

export type EditOperation = z.infer<typeof editOperationSchema>;

const draftInput = z.object({
  title: z.string().min(1).max(160),
  blocks: z.array(draftBlockSchema).min(1).max(60),
  expectedRevision: revision.optional(),
  dryRun: z.boolean().optional(),
}).strict();

const editInput = z.object({
  operations: z.array(editOperationSchema).min(1).max(40),
  expectedRevision: revision.optional(),
  dryRun: z.boolean().optional(),
}).strict();

const receiptInput = z.object({ detail: z.enum(["outline", "text", "json"]).optional() }).strict();
const recipesInput = z.object({ situation: z.string().max(400).optional() }).strict();
const printInput = z.object({ expectedRevision: revision, reason: z.string().min(1).max(240).optional() }).strict();
const openInput = z.object({ highlight: z.array(z.string()).max(20).optional() }).strict();

/** Resolves a 1-based position against the current block list. */
function blockAt(document: ReceiptDocument, at: number): ReceiptBlock {
  const block = document.blocks[at - 1];
  if (!block) throw new Error(`There is no block at position ${at}; the receipt has ${document.blocks.length}.`);
  return block;
}

function matchIndex(haystack: string[], reference: number | string, what: string): number {
  if (typeof reference === "number") {
    if (reference < 1 || reference > haystack.length) throw new Error(`There is no ${what} ${reference}; there are ${haystack.length}.`);
    return reference - 1;
  }
  const needle = reference.trim().toLowerCase();
  const exact = haystack.findIndex((candidate) => candidate.trim().toLowerCase() === needle);
  if (exact >= 0) return exact;
  const partial = haystack.findIndex((candidate) => candidate.toLowerCase().includes(needle));
  if (partial < 0) throw new Error(`No ${what} matching “${reference}”. Present: ${haystack.join(", ") || "none"}.`);
  return partial;
}

function replaceBlock(document: ReceiptDocument, index: number, block: ReceiptBlock) {
  document.blocks = document.blocks.map((existing, position) => (position === index ? block : existing));
}

async function applyEditOperations(document: ReceiptDocument, operations: EditOperation[], dependencies?: CatalogDependencies) {
  for (const operation of operations) {
    if (operation.op === "setTitle") { document.title = operation.title; continue; }

    if (operation.op === "add") {
      const block = await compileDraftBlock(operation.block, dependencies);
      const index = operation.at ? Math.min(operation.at - 1, document.blocks.length) : document.blocks.length;
      document.blocks = [...document.blocks.slice(0, index), block, ...document.blocks.slice(index)];
      continue;
    }

    const index = operation.at - 1;
    const target = blockAt(document, operation.at);

    if (operation.op === "replace") { replaceBlock(document, index, { ...await compileDraftBlock(operation.block, dependencies), id: target.id }); continue; }
    if (operation.op === "remove") {
      if (document.blocks.length <= 1) throw new Error("A receipt needs at least one block; replace it instead of removing it.");
      document.blocks = document.blocks.filter((_, position) => position !== index);
      continue;
    }
    if (operation.op === "move") {
      const rest = document.blocks.filter((_, position) => position !== index);
      const to = Math.min(operation.to - 1, rest.length);
      document.blocks = [...rest.slice(0, to), target, ...rest.slice(to)];
      continue;
    }
    if (operation.op === "refresh") {
      if (target.type !== "catalog") throw new Error(`Block ${operation.at} is a ${target.type} block and has no live data to refresh.`);
      replaceBlock(document, index, await refreshCatalogBlock(target, dependencies));
      continue;
    }

    // Item operations, so one change never rewrites a whole block while a human is typing in it.
    const descriptor = collectionFor(target);
    if (!descriptor) {
      const refreshable = target.type === "catalog" && "refreshedAt" in target;
      throw new Error(`Block ${operation.at} is a ${blockLabel(target)} block and has no editable lines.${refreshable ? " Use refresh to update it." : ""}`);
    }
    if (operation.op === "addItem") { replaceBlock(document, index, addChild(descriptor, target, operation)); continue; }

    const view = viewCollection(descriptor, target);
    const address = view.addresses[matchIndex(view.keys, operation.item, view.noun)];
    replaceBlock(document, index, operation.op === "removeItem"
      ? removeChild(descriptor, target, address)
      : writeChild(descriptor, target, address, operation.op === "checkItem" ? { checked: operation.checked ?? true } : operation));
  }

  return receiptDocumentSchema.parse(document) as ReceiptDocument;
}

function reportChange(before: ReceiptDocument, after: ReceiptDocument, revisionAfter: number | undefined, dryRun: boolean) {
  const measured = measureReceipt(after);
  const changes = diffReceipts(before, after);
  const heading = dryRun ? "Dry run — nothing was changed." : `Updated to revision ${revisionAfter}.`;
  const body = [
    heading,
    changes.length ? changes.join("\n") : "No visible change.",
    `${after.blocks.length} blocks · ~${measured.paperLengthMm}mm of paper (${measured.widthDots}×${measured.heightDots} dots)`,
    ...(measured.warnings.length ? [`! ${measured.warnings.join("\n! ")}`] : []),
  ].join("\n");
  return {
    text: clampOutput(body).text,
    data: {
      status: dryRun ? "dry_run" : "updated",
      revision: revisionAfter,
      changes,
      paperLengthMm: measured.paperLengthMm,
      width: measured.widthDots,
      height: measured.heightDots,
      warnings: measured.warnings,
      nextAction: dryRun ? "Call again without dryRun to apply this." : "Check the visible receipt, then request_receipt_print when it is right.",
    },
  };
}

export function createAgentTools(backend: AgentBackend): AgentToolDefinition[] {
  const notify = (activity: AgentActivity) => backend.onActivity?.(activity);

  async function requireState(expected: number | undefined, signal?: AbortSignal) {
    const state = await backend.getState(signal);
    if (expected !== undefined && expected !== state.revision) throw new StaleRevision(expected, state.revision);
    return state;
  }

  return [
    {
      name: "get_app_status",
      title: "Check Pete's Printer",
      description: "Reports the editor URL, whether setup is done, whether the printer bridge is reachable, the current print policy, and the last print result. Call this first when you are not sure the app is ready.",
      inputSchema: emptyInput,
      readOnly: true,
      untrustedContent: false,
      async execute(input, signal) {
        emptyInput.parse(input ?? {});
        const status = await backend.status(signal);
        const state = await backend.getState(signal);
        const text = [
          `Editor: ${status.editorUrl}`,
          `Setup: ${status.configured ? "done" : "not finished — send the person to the editor first"}`,
          `Printer: ${status.bridgeOnline ? "online" : "offline — you can still draft, but printing will fail"}`,
          `Print policy: ${status.printPolicy}${status.printPolicy === "confirm" ? " (every print waits for a human tap)" : ""}`,
          status.syncStatus ? `Sync: ${status.syncStatus}` : undefined,
          status.lastPrint ? `Last print: ${status.lastPrint.status} — ${status.lastPrint.message}` : undefined,
          `Receipt: “${state.document.title}” at revision ${state.revision}, ${state.document.blocks.length} blocks`,
        ].filter(Boolean).join("\n");
        return { text: clampOutput(text).text, data: { status: "ok", ...status, revision: state.revision, nextAction: "Use list_receipt_recipes when the person describes a situation, or get_receipt before editing." } };
      },
    },

    {
      name: "get_receipt",
      title: "Read the receipt",
      description: "Returns what is on the paper right now and its revision. Defaults to a compact outline with one line per block; pass detail=text for a plain-text stand-in of the print, or detail=json for the raw document. Read this before editing.",
      inputSchema: receiptInput,
      readOnly: true,
      untrustedContent: true,
      async execute(input, signal) {
        const { detail = "outline" } = receiptInput.parse(input ?? {});
        notify({ phase: "reading", message: "The agent is reading the receipt" });
        const state = await backend.getState(signal);
        const body = detail === "json" ? JSON.stringify(state.document) : detail === "text" ? renderReceiptText(state.document) : outlineReceipt(state.document, state.revision);
        const clamped = clampOutput(body);
        return {
          text: clamped.text,
          data: {
            status: "ok",
            revision: state.revision,
            blockCount: state.document.blocks.length,
            truncated: clamped.truncated,
            nextAction: clamped.truncated ? "Ask for a single detail level, or edit by position instead of reading the whole document." : "Edit with edit_receipt, or replace everything with draft_receipt. Blocks are addressed by their 1-based position.",
          },
        };
      },
    },

    {
      name: "list_receipt_blocks",
      title: "List block types",
      description: "The vocabulary you can put on a receipt, with a note on when each one earns its place and what it needs. Blocks marked live fetch real data when you add them.",
      inputSchema: emptyInput,
      readOnly: true,
      untrustedContent: false,
      async execute(input) {
        emptyInput.parse(input ?? {});
        const text = blockVocabulary.map((entry) => {
          const fields = entry.collection ? collectionFields[entry.collection] ?? [] : [];
          return `${entry.type}${entry.live ? " (live)" : ""} — ${entry.whenToUse} Needs: ${entry.needs}${fields.length ? ` Line fields: ${fields.join(", ")}` : ""}`;
        }).join("\n");
        const forms = ["mealPlan (meals: breakfast/lunch/dinner; field detail)", "meetingNotes (groups: decisions/actions; fields owner, due)", "workoutLog (fields sets, reps, load)"].join("; ");
        return { text: clampOutput(`${text}\nFillable forms, via addItem: ${forms}`).text, data: { status: "ok", blocks: blockVocabulary, formCollections: forms, nextAction: "Compose them with draft_receipt." } };
      },
    },

    {
      name: "list_receipt_recipes",
      title: "List situations",
      description: "Call this whenever someone describes a situation rather than naming blocks — travelling, a morning routine, a shopping trip, a meeting. Returns the blocks that belong on that receipt and the details worth confirming before you draft.",
      inputSchema: recipesInput,
      readOnly: true,
      untrustedContent: false,
      async execute(input) {
        const { situation } = recipesInput.parse(input ?? {});
        const matched = situation ? suggestRecipes(situation) : [];
        const chosen = matched.length ? matched : recipes;
        const text = chosen.map((recipe) => `${recipe.id} — ${recipe.name}\n  blocks: ${recipe.blocks.join(", ")}\n  ask: ${recipe.asks.join("; ")}\n  ${recipe.note}`).join("\n");
        return {
          text: clampOutput(text).text,
          data: { status: "ok", matched: matched.map((recipe) => recipe.id), recipes: chosen, nextAction: "Ask the person for anything in `ask` you do not already know, then call draft_receipt." },
        };
      },
    },

    {
      name: "draft_receipt",
      title: "Draft a receipt",
      description: "Replaces the whole receipt with a new one, composed from the block vocabulary. This is the main tool: one call turns a described situation into finished paper. It never prints. Pass dryRun to see the result and its paper length without changing anything.",
      inputSchema: draftInput,
      readOnly: false,
      untrustedContent: true,
      async execute(input, signal) {
        const parsed = draftInput.parse(input);
        const state = await requireState(parsed.expectedRevision, signal);
        notify({ phase: "drafting", message: "The agent is drafting a receipt" });
        const blocks = await compileDraftBlocks(parsed.blocks, backend.dependencies);
        const next = receiptDocumentSchema.parse({ ...state.document, title: parsed.title, blocks }) as ReceiptDocument;
        if (parsed.dryRun) {
          notify({ phase: "complete", message: "The agent previewed a draft" });
          return reportChange(state.document, next, undefined, true);
        }
        const committed = await backend.commit(state.revision, next, `Drafted “${parsed.title}”.`, signal);
        notify({ phase: "complete", message: `The agent drafted “${parsed.title}”`, blockIds: committed.document.blocks.map((block) => block.id) });
        return reportChange(state.document, committed.document, committed.revision, false);
      },
    },

    {
      name: "edit_receipt",
      title: "Edit the receipt",
      description: "Changes part of the receipt without rewriting it. Blocks are addressed by 1-based position from get_receipt. The item operations touch a single line — use them whenever someone may be editing the same receipt by hand. They reach checklists, facts, tables, agendas, habit rows, countdown milestones, grouped lists, meal plans, meeting notes and workout logs; `group` picks a section and `fields` sets named attributes like owner, due, sets or value. Pass dryRun to preview.",
      inputSchema: editInput,
      readOnly: false,
      untrustedContent: true,
      async execute(input, signal) {
        const parsed = editInput.parse(input);
        const state = await requireState(parsed.expectedRevision, signal);
        notify({ phase: "editing", message: "The agent is editing the receipt" });
        const next = await applyEditOperations(structuredClone(state.document), parsed.operations, backend.dependencies);
        if (parsed.dryRun) {
          notify({ phase: "complete", message: "The agent previewed an edit" });
          return reportChange(state.document, next, undefined, true);
        }
        const summary = parsed.operations.map((operation) => operation.op).join(", ");
        const committed = await backend.commit(state.revision, next, `Applied ${summary}.`, signal);
        notify({ phase: "complete", message: `The agent applied ${parsed.operations.length} change${parsed.operations.length === 1 ? "" : "s"}`, blockIds: committed.document.blocks.map((block) => block.id) });
        return reportChange(state.document, committed.document, committed.revision, false);
      },
    },

    {
      name: "preview_receipt",
      title: "Preview the print",
      description: "Shows what will actually come out of the printer as plain text, with the exact dot dimensions, the paper length in millimetres, and any warnings. In the browser this also scrolls the preview into view. Check this before asking to print.",
      inputSchema: emptyInput,
      readOnly: true,
      untrustedContent: true,
      async execute(input, signal) {
        emptyInput.parse(input ?? {});
        notify({ phase: "reading", message: "The agent is checking the preview" });
        const state = await backend.getState(signal);
        backend.focusPreview?.();
        const measured = measureReceipt(state.document);
        const body = [
          `Revision ${state.revision} · ${measured.widthDots}×${measured.heightDots} dots · ~${measured.paperLengthMm}mm of paper`,
          ...(measured.warnings.length ? [`! ${measured.warnings.join("\n! ")}`] : []),
          "",
          renderReceiptText(state.document),
        ].join("\n");
        const clamped = clampOutput(body);
        return {
          text: clamped.text,
          data: { status: "ok", revision: state.revision, ...measured, truncated: clamped.truncated, nextAction: "Call request_receipt_print with this revision when it looks right." },
        };
      },
    },

    {
      name: "undo_agent_edit",
      title: "Undo the last change",
      description: "Steps the receipt back to how it was before the last change. Use this when someone says that was not what they meant, instead of rebuilding the previous version by hand.",
      inputSchema: emptyInput,
      readOnly: false,
      untrustedContent: false,
      async execute(input) {
        emptyInput.parse(input ?? {});
        if (!backend.undo) throw new Error("Undo is only available in the browser editor.");
        const before = await backend.getState();
        const state = await backend.undo();
        if (!state) throw new Error("There is nothing to undo.");
        notify({ phase: "complete", message: "The agent undid the last change", blockIds: state.document.blocks.map((block) => block.id) });
        return reportChange(before.document, state.document, state.revision, false);
      },
    },

    {
      name: "request_receipt_print",
      title: "Request a print",
      description: "Prints the exact revision you name. This is consequential and irreversible — paper comes out. Depending on the person's settings it may pause for an explicit tap of approval in the browser. Preview first.",
      inputSchema: printInput,
      readOnly: false,
      untrustedContent: false,
      async execute(input, signal) {
        const parsed = printInput.parse(input);
        const state = await backend.getState(signal);
        if (parsed.expectedRevision !== state.revision) throw new StaleRevision(parsed.expectedRevision, state.revision);
        notify({ phase: "waitingForApproval", message: "The agent is requesting print approval", blockIds: state.document.blocks.map((block) => block.id) });
        const result = await backend.requestPrint(parsed.expectedRevision, parsed.reason, signal);
        notify({ phase: result.status === "failed" || result.status === "unknown" ? "error" : "complete", message: result.message });
        return {
          text: result.message,
          data: {
            ...result,
            nextAction: result.status === "succeeded" ? "It printed. Nothing further is needed."
              : result.status === "awaiting_approval" ? "Tell them to tap “Approve and print” in the browser, then confirm with get_print_job_status. Do not resubmit."
              : result.status === "unknown" ? "Check the printer itself before trying again — the job may have partly printed."
              : result.status === "rejected" ? "The person declined. Ask what to change."
              : "Read the receipt again and try once more.",
          },
          isError: result.status === "failed" || result.status === "unknown",
        };
      },
    },

    {
      name: "open_receipt_editor",
      title: "Open the editor",
      description: "Brings up the visible receipt editor so the person can see and adjust the draft before it prints. Use this after drafting whenever they should look before you print.",
      inputSchema: openInput,
      readOnly: false,
      untrustedContent: false,
      async execute(input, signal) {
        const parsed = openInput.parse(input ?? {});
        const status = await backend.status(signal);
        backend.openEditor?.(parsed.highlight);
        return { text: `The editor is at ${status.editorUrl}.`, data: { status: "ok", editorUrl: status.editorUrl, nextAction: "Ask the person to look, then print when they are happy." } };
      },
    },
  ];
}

/** Central error contract, so every adapter reports failures the same way. */
export async function runAgentTool(tool: AgentToolDefinition, input: unknown, backend: AgentBackend, signal?: AbortSignal): Promise<AgentToolResult> {
  try {
    return await tool.execute(input, signal);
  } catch (error) {
    const current = await Promise.resolve(backend.getState(signal)).then((state) => state.revision).catch(() => undefined);
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`);
      return { text: `That input did not match the schema.\n${issues.join("\n")}`, data: { status: "invalid_input", issues, currentRevision: current, nextAction: "Fix the fields above and call again." }, isError: true };
    }
    if (error instanceof StaleRevision) {
      backend.onActivity?.({ phase: "error", message: "The agent used a stale revision" });
      return { text: error.message, data: { status: "stale", currentRevision: error.current, nextAction: "Call get_receipt and retry with the revision it returns." }, isError: true };
    }
    const message = error instanceof Error ? error.message : "The receipt tool failed.";
    backend.onActivity?.({ phase: "error", message: "The agent hit an error" });
    return { text: message, data: { status: "error", currentRevision: current, nextAction: "Read the message, adjust, and try once more." }, isError: true };
  }
}

export { describeBlock };
