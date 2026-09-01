import { describe, expect, it, vi } from "vitest";
import { createDefaultDocument, createReceiptState } from "../receipt";
import { registerWebMcpTools, type WebMcpActions } from "./register";

function actions(overrides: Partial<WebMcpActions> = {}): WebMcpActions {
  const state = createReceiptState(createDefaultDocument());
  return {
    getState: () => state,
    listCatalog: () => [],
    applyOperations: () => state,
    draftReminder: () => state,
    loadTemplate: () => state,
    preview: () => ({ revision: 0, width: 576, height: 200, blockCount: 2 }),
    requestPrint: async () => ({ status: "rejected", revision: 0, message: "Kept as a draft." }),
    ...overrides,
  };
}

describe("WebMCP registration", () => {
  it("registers seven strict tools and cleans them up with one signal", async () => {
    const tools: any[] = [];
    const signals: AbortSignal[] = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: vi.fn((tool, options) => { tools.push(tool); signals.push(options.signal); }) } });
    const registration = registerWebMcpTools(actions());
    expect(await registration.ready).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual(["get_receipt", "list_block_catalog", "draft_reminder", "apply_receipt_operations", "load_receipt_template", "preview_receipt", "request_receipt_print"]);
    expect(tools.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
    expect(new Set(signals).size).toBe(1);
    registration.dispose();
    expect(signals[0].aborted).toBe(true);
  });

  it("returns structured invalid and stale results without invoking mutations", async () => {
    const tools: any[] = [];
    const applyOperations = vi.fn();
    const requestPrint = vi.fn();
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: any) => tools.push(tool) } });
    const registration = registerWebMcpTools(actions({ applyOperations, requestPrint }));
    await registration.ready;
    const apply = tools.find((tool) => tool.name === "apply_receipt_operations");
    const print = tools.find((tool) => tool.name === "request_receipt_print");
    expect(await apply.execute({ expectedRevision: 0, operations: [{ type: "setTitle", title: "New", extra: true }] })).toMatchObject({ status: "invalid_input" });
    expect(await print.execute({ expectedRevision: 2 })).toMatchObject({ status: "stale", currentRevision: 0 });
    expect(applyOperations).not.toHaveBeenCalled();
    expect(requestPrint).not.toHaveBeenCalled();
  });

  it("does not report readiness when any tool registration fails", async () => {
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: any) => {
      if (tool.name === "draft_reminder") throw new Error("unsupported");
    } } });
    const registration = registerWebMcpTools(actions());
    expect(await registration.ready).toBe(false);
    expect(registration.errors).toEqual(["draft_reminder: unsupported"]);
  });
});
