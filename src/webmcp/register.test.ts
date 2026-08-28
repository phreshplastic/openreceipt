import { describe, expect, it, vi } from "vitest";
import { createDefaultDocument, createReceiptState } from "../receipt";
import { registerWebMcpTools } from "./register";

describe("WebMCP registration", () => {
  it("registers the five receipt tools and cleans them up with one signal", async () => {
    const tools: any[] = [];
    const signals: AbortSignal[] = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: vi.fn((tool, options) => { tools.push(tool); signals.push(options.signal); }) } });
    const state = createReceiptState(createDefaultDocument());
    const registration = registerWebMcpTools({
      getState: () => state,
      applyOperations: () => state,
      loadTemplate: () => state,
      preview: () => ({ revision: 0, width: 576, height: 200, blockCount: 2 }),
      requestPrint: async () => ({ status: "rejected" }),
    });
    await Promise.resolve();
    expect(tools.map((tool) => tool.name)).toEqual(["get_receipt", "apply_receipt_operations", "load_receipt_template", "preview_receipt", "request_receipt_print"]);
    expect(new Set(signals).size).toBe(1);
    registration.dispose();
    expect(signals[0].aborted).toBe(true);
  });
});
