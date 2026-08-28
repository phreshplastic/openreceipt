import type { ReceiptOperation, ReceiptState } from "../receipt";

type Tool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute(input: any): unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool(tool: Tool, options?: { signal?: AbortSignal }): Promise<void> | void;
};

type WebMcpActions = {
  getState(): ReceiptState;
  applyOperations(expectedRevision: number, operations: ReceiptOperation[]): ReceiptState;
  loadTemplate(templateId: string, expectedRevision: number): ReceiptState;
  preview(): { revision: number; width: number; height: number; blockCount: number };
  requestPrint(): Promise<unknown>;
};

const operationSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    required: ["type"],
    properties: {
      type: { enum: ["setTitle", "setPage", "add", "replace", "remove", "move"] },
      id: { type: "string", format: "uuid" },
      title: { type: "string", minLength: 1 },
      page: { type: "object" },
      index: { type: "integer", minimum: 0 },
      toIndex: { type: "integer", minimum: 0 },
      block: { type: "object", description: "A complete receipt block matching the receipt schema." },
    },
  },
};

export function registerWebMcpTools(actions: WebMcpActions) {
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!modelContext) return { available: false, dispose() {} };
  const controller = new AbortController();
  const register = (tool: Tool) => Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => undefined);

  void register({
    name: "get_receipt",
    title: "Read current receipt",
    description: "Returns the complete receipt document and its current revision. Read this before editing.",
    annotations: { readOnlyHint: true },
    execute: () => actions.getState(),
  });

  void register({
    name: "apply_receipt_operations",
    title: "Edit current receipt",
    description: "Atomically adds, replaces, removes, or moves blocks in the visible receipt. Uses the revision from get_receipt to prevent overwriting human edits.",
    inputSchema: {
      type: "object",
      required: ["expectedRevision", "operations"],
      properties: { expectedRevision: { type: "integer", minimum: 0 }, operations: operationSchema },
    },
    annotations: { readOnlyHint: false },
    execute: ({ expectedRevision, operations }) => actions.applyOperations(expectedRevision, operations),
  });

  void register({
    name: "load_receipt_template",
    title: "Load a receipt template",
    description: "Replaces the visible receipt with the blank or checklist template.",
    inputSchema: {
      type: "object",
      required: ["templateId", "expectedRevision"],
      properties: { templateId: { enum: ["blank", "checklist"] }, expectedRevision: { type: "integer", minimum: 0 } },
    },
    annotations: { readOnlyHint: false },
    execute: ({ templateId, expectedRevision }) => actions.loadTemplate(templateId, expectedRevision),
  });

  void register({
    name: "preview_receipt",
    title: "Preview current receipt",
    description: "Focuses the visible print preview and returns its exact thermal-printer dimensions.",
    annotations: { readOnlyHint: true },
    execute: () => actions.preview(),
  });

  void register({
    name: "request_receipt_print",
    title: "Request printing",
    description: "Requests printing of the visible receipt. The configured print permission may require the user to approve it first.",
    annotations: { readOnlyHint: false },
    execute: () => actions.requestPrint(),
  });

  return { available: true, dispose: () => controller.abort() };
}
