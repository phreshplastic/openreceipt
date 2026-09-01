import { z } from "zod";
import type { ReceiptCommand } from "../block-library";
import type { PrintResult } from "../printing/coordinator";
import { receiptBlockSchema, type ReceiptState, type ReminderDraft } from "../receipt";

export type AgentPhase = "reading" | "drafting" | "editing" | "waitingForApproval" | "printing" | "complete" | "error";
export type AgentActivity = { phase: AgentPhase; message: string; blockIds?: string[] };

type ToolContext = { signal?: AbortSignal };
type Tool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute(input: unknown, context?: ToolContext): unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool(tool: Tool, options?: { signal?: AbortSignal }): Promise<void> | void;
};

export type WebMcpActions = {
  getState(signal?: AbortSignal): ReceiptState;
  applyOperations(expectedRevision: number, operations: ReceiptCommand[], signal?: AbortSignal): ReceiptState | Promise<ReceiptState>;
  draftReminder(expectedRevision: number, reminder: ReminderDraft, signal?: AbortSignal): ReceiptState;
  listCatalog(signal?: AbortSignal): unknown;
  loadTemplate(templateId: string, expectedRevision: number, signal?: AbortSignal): ReceiptState;
  preview(signal?: AbortSignal): { revision: number; width: number; height: number; blockCount: number };
  requestPrint(expectedRevision: number, reason: string | undefined, signal?: AbortSignal): Promise<PrintResult>;
  onActivity?(activity: AgentActivity): void;
};

const emptyInputSchema = z.object({}).strict();
const revisionSchema = z.number().int().min(0);
const uuidSchema = z.string().uuid();
const pageSchema = z.object({
  paperWidthMm: z.union([z.literal(80), z.literal(58)]),
  printableWidthDots: z.union([z.literal(576), z.literal(420)]),
  paddingDots: z.number().int().min(0).max(80),
}).strict();
const receiptOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setTitle"), title: z.string().min(1).max(160) }).strict(),
  z.object({ type: z.literal("setPage"), page: pageSchema }).strict(),
  z.object({ type: z.literal("add"), block: receiptBlockSchema, index: z.number().int().min(0).optional() }).strict(),
  z.object({ type: z.literal("replace"), id: uuidSchema, block: receiptBlockSchema }).strict(),
  z.object({ type: z.literal("remove"), id: uuidSchema }).strict(),
  z.object({ type: z.literal("move"), id: uuidSchema, toIndex: z.number().int().min(0) }).strict(),
  z.object({
    type: z.literal("insertCatalogBlock"),
    kind: z.enum(["weather", "agenda", "habit", "dailyPlan"]),
    config: z.object({ city: z.string().min(1).max(160), unit: z.enum(["fahrenheit", "celsius"]) }).strict().optional(),
    index: z.number().int().min(0).optional(),
  }).strict(),
  z.object({ type: z.literal("refreshCatalogBlock"), id: uuidSchema }).strict(),
]);
const applyInputSchema = z.object({ expectedRevision: revisionSchema, operations: z.array(receiptOperationSchema).min(1).max(100) }).strict();
const templateInputSchema = z.object({ templateId: z.enum(["blank", "checklist"]), expectedRevision: revisionSchema }).strict();
const reminderInputSchema = z.object({
  expectedRevision: revisionSchema,
  title: z.string().min(1).max(160),
  message: z.string().min(1).max(2_000),
  when: z.string().min(1).max(160).optional(),
  checklist: z.array(z.string().min(1).max(300)).max(8).optional(),
}).strict();
const printInputSchema = z.object({ expectedRevision: revisionSchema, reason: z.string().min(1).max(240).optional() }).strict();

function jsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

function issueResult(error: unknown, currentRevision?: number) {
  if (error instanceof z.ZodError) {
    return { status: "invalid_input", message: "The tool input did not match the receipt contract.", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), currentRevision };
  }
  if (error instanceof Error && error.name === "StaleReceiptRevisionError") {
    return { status: "stale", message: error.message, currentRevision };
  }
  return { status: "error", message: error instanceof Error ? error.message : "The receipt tool failed.", currentRevision };
}

function changedBlockIds(before: ReceiptState, after: ReceiptState) {
  const previous = new Map(before.document.blocks.map((block) => [block.id, JSON.stringify(block)]));
  const currentIds = new Set(after.document.blocks.map((block) => block.id));
  return [
    ...after.document.blocks.filter((block) => previous.get(block.id) !== JSON.stringify(block)).map((block) => block.id),
    ...before.document.blocks.filter((block) => !currentIds.has(block.id)).map((block) => block.id),
  ];
}

export function registerWebMcpTools(actions: WebMcpActions) {
  const modelContext = typeof document === "undefined" ? undefined : (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!modelContext) return { available: false, ready: Promise.resolve(false), errors: [] as string[], dispose() {} };
  const controller = new AbortController();
  const errors: string[] = [];
  const signalFor = (context?: ToolContext) => context?.signal ?? controller.signal;
  const notify = (activity: AgentActivity) => actions.onActivity?.(activity);

  const tools: Tool[] = [
    {
      name: "get_receipt",
      title: "Read current receipt",
      description: "Returns the complete visible receipt, its revision, source, print readiness, and the safest next action. Read this before editing.",
      inputSchema: jsonSchema(emptyInputSchema),
      annotations: { readOnlyHint: true },
      execute: (input, context) => {
        try {
          emptyInputSchema.parse(input ?? {});
          notify({ phase: "reading", message: "Codex is reading the receipt" });
          const state = actions.getState(signalFor(context));
          return { status: "ok", revision: state.revision, document: state.document, source: state.source ?? { kind: "draft" }, printReadiness: "draft", nextAction: "Use the returned revision for any edit or print request." };
        } catch (error) { return issueResult(error); }
      },
    },
    {
      name: "list_block_catalog",
      title: "List available receipt blocks",
      description: "Lists Block Library entries that can be inserted, including their configuration requirements.",
      inputSchema: jsonSchema(emptyInputSchema),
      annotations: { readOnlyHint: true },
      execute: (input, context) => {
        try {
          emptyInputSchema.parse(input ?? {});
          notify({ phase: "reading", message: "Codex is checking available blocks" });
          return { status: "ok", catalog: actions.listCatalog(signalFor(context)), nextAction: "Insert one with apply_receipt_operations and the current receipt revision." };
        } catch (error) { return issueResult(error); }
      },
    },
    {
      name: "draft_reminder",
      title: "Draft a reminder",
      description: "Replaces the visible draft with a polished reminder. It never prints; request_receipt_print is a separate permission-gated action.",
      inputSchema: jsonSchema(reminderInputSchema),
      annotations: { readOnlyHint: false },
      execute: (input, context) => {
        const current = actions.getState(signalFor(context));
        try {
          const { expectedRevision, ...reminder } = reminderInputSchema.parse(input);
          notify({ phase: "drafting", message: "Codex is drafting a reminder" });
          const next = actions.draftReminder(expectedRevision, reminder, signalFor(context));
          const blockIds = next.document.blocks.map((block) => block.id);
          notify({ phase: "complete", message: "Codex drafted the reminder", blockIds });
          return { status: "updated", revision: next.revision, changedBlockIds: blockIds, summary: `Drafted “${next.document.title}”.`, nextAction: "Review the visible receipt, then request printing with this revision if it is correct." };
        } catch (error) {
          notify({ phase: "error", message: "Codex could not draft the reminder" });
          return issueResult(error, current.revision);
        }
      },
    },
    {
      name: "apply_receipt_operations",
      title: "Edit current receipt",
      description: "Atomically edits core blocks, inserts Block Library entries, or refreshes saved live blocks. expectedRevision prevents overwriting human edits.",
      inputSchema: jsonSchema(applyInputSchema),
      annotations: { readOnlyHint: false },
      execute: async (input, context) => {
        const before = actions.getState(signalFor(context));
        try {
          const parsed = applyInputSchema.parse(input);
          notify({ phase: "editing", message: "Codex is editing the receipt" });
          const next = await actions.applyOperations(parsed.expectedRevision, parsed.operations as ReceiptCommand[], signalFor(context));
          const blockIds = changedBlockIds(before, next);
          notify({ phase: "complete", message: `Codex updated ${blockIds.length || "the receipt"}${blockIds.length ? ` block${blockIds.length === 1 ? "" : "s"}` : ""}`, blockIds });
          return { status: "updated", revision: next.revision, changedBlockIds: blockIds, summary: "Applied the operations atomically.", nextAction: "Review the visible receipt before requesting a print." };
        } catch (error) {
          notify({ phase: "error", message: "Codex could not edit the receipt" });
          return issueResult(error, actions.getState().revision);
        }
      },
    },
    {
      name: "load_receipt_template",
      title: "Load a receipt template",
      description: "Replaces the visible receipt with the blank or checklist template at an expected revision.",
      inputSchema: jsonSchema(templateInputSchema),
      annotations: { readOnlyHint: false },
      execute: (input, context) => {
        const current = actions.getState(signalFor(context));
        try {
          const parsed = templateInputSchema.parse(input);
          notify({ phase: "editing", message: "Codex is loading a template" });
          const next = actions.loadTemplate(parsed.templateId, parsed.expectedRevision, signalFor(context));
          const blockIds = next.document.blocks.map((block) => block.id);
          notify({ phase: "complete", message: `Codex loaded ${parsed.templateId}`, blockIds });
          return { status: "updated", revision: next.revision, changedBlockIds: blockIds, summary: `Loaded the ${parsed.templateId} template.`, nextAction: "Review or edit the visible receipt." };
        } catch (error) {
          notify({ phase: "error", message: "Codex could not load the template" });
          return issueResult(error, current.revision);
        }
      },
    },
    {
      name: "preview_receipt",
      title: "Preview current receipt",
      description: "Focuses the visible preview and returns the exact thermal-printer dimensions for the current revision.",
      inputSchema: jsonSchema(emptyInputSchema),
      annotations: { readOnlyHint: true },
      execute: (input, context) => {
        try {
          emptyInputSchema.parse(input ?? {});
          notify({ phase: "reading", message: "Codex is checking the print preview" });
          return { status: "ok", ...actions.preview(signalFor(context)), nextAction: "Review the focused preview before printing." };
        } catch (error) { return issueResult(error); }
      },
    },
    {
      name: "request_receipt_print",
      title: "Request printing",
      description: "Requests printing of the exact visible receipt revision. This is consequential and may pause for explicit human approval.",
      inputSchema: jsonSchema(printInputSchema),
      annotations: { readOnlyHint: false },
      execute: async (input, context) => {
        const current = actions.getState(signalFor(context));
        try {
          const parsed = printInputSchema.parse(input);
          if (parsed.expectedRevision !== current.revision) return { status: "stale", revision: parsed.expectedRevision, currentRevision: current.revision, message: "The receipt changed. Read it again before requesting a print." };
          notify({ phase: "waitingForApproval", message: "Codex is requesting print approval", blockIds: current.document.blocks.map((block) => block.id) });
          const result = await actions.requestPrint(parsed.expectedRevision, parsed.reason, signalFor(context));
          notify({ phase: result.status === "failed" || result.status === "unknown" ? "error" : "complete", message: result.message });
          return { ...result, nextAction: result.status === "succeeded" ? "The print is complete." : result.status === "unknown" ? "Check the printer before trying anything else." : "Review the result before making another request." };
        } catch (error) {
          notify({ phase: "error", message: "Codex could not request printing" });
          return issueResult(error, current.revision);
        }
      },
    },
  ];

  const ready = Promise.all(tools.map(async (tool) => {
    try { await modelContext.registerTool(tool, { signal: controller.signal }); }
    catch (error) {
      errors.push(`${tool.name}: ${error instanceof Error ? error.message : "registration failed"}`);
      throw error;
    }
  })).then(() => true).catch(() => { controller.abort(); return false; });

  return { available: true, ready, errors, dispose: () => controller.abort() };
}
