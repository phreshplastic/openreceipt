import { describe, expect, it, vi } from "vitest";
import { createDefaultDocument } from "../receipt/templates";
import { createReceiptState } from "../receipt/controller";
import type { AgentBackend } from "../agent";
import { registerWebMcpTools } from "./register";

type StubTool = { name: string; annotations?: Record<string, boolean>; inputSchema: Record<string, unknown>; execute(input?: unknown): Promise<{ structuredContent: Record<string, unknown> }> };

function backend(overrides: Partial<AgentBackend> = {}): AgentBackend {
  const state = createReceiptState(createDefaultDocument());
  return {
    getState: () => state,
    commit: () => state,
    requestPrint: async () => ({ status: "rejected", revision: 0, message: "Kept as a draft." }),
    status: () => ({ editorUrl: "http://127.0.0.1:8731/app", configured: true, bridgeOnline: true, printPolicy: "confirm" }),
    ...overrides,
  };
}

function install(registerTool: (tool: StubTool, options?: { signal?: AbortSignal }) => void, on: "document" | "navigator" = "document") {
  Object.defineProperty(document, "modelContext", { configurable: true, value: on === "document" ? { registerTool } : undefined });
  Object.defineProperty(navigator, "modelContext", { configurable: true, value: on === "navigator" ? { registerTool } : undefined });
}

describe("WebMCP registration", () => {
  it("registers every agent tool and tears them all down with one signal", async () => {
    const tools: StubTool[] = [];
    const signals: (AbortSignal | undefined)[] = [];
    install((tool, options) => { tools.push(tool); signals.push(options?.signal); });
    const registration = registerWebMcpTools(backend());
    expect(await registration.ready).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual([
      "get_app_status", "get_receipt", "list_receipt_blocks", "list_receipt_recipes",
      "draft_receipt", "edit_receipt", "rename_receipt", "preview_receipt", "undo_agent_edit",
      "request_receipt_print", "open_receipt_editor",
    ]);
    expect(tools.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
    expect(new Set(signals).size).toBe(1);
    registration.dispose();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("finds the origin-trial global when the document one is absent", async () => {
    const tools: StubTool[] = [];
    install((tool) => tools.push(tool), "navigator");
    expect(await registerWebMcpTools(backend()).ready).toBe(true);
    expect(tools).not.toHaveLength(0);
  });

  it("marks read-only tools and flags results that can carry feed text", async () => {
    const tools: StubTool[] = [];
    install((tool) => tools.push(tool));
    await registerWebMcpTools(backend()).ready;
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(byName.get("get_receipt")?.annotations).toMatchObject({ readOnlyHint: true, untrustedContentHint: true });
    expect(byName.get("draft_receipt")?.annotations).toMatchObject({ readOnlyHint: false });
    expect(byName.get("open_receipt_editor")?.annotations).toMatchObject({ untrustedContentHint: false });
  });

  it("returns structured errors without invoking mutations", async () => {
    const tools: StubTool[] = [];
    const commit = vi.fn();
    const requestPrint = vi.fn();
    install((tool) => tools.push(tool));
    await registerWebMcpTools(backend({ commit, requestPrint })).ready;
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect((await byName.get("edit_receipt")!.execute({ operations: [{ op: "setTitle", title: "New", extra: true }] })).structuredContent).toMatchObject({ status: "invalid_input" });
    expect((await byName.get("request_receipt_print")!.execute({ expectedRevision: 2 })).structuredContent).toMatchObject({ status: "stale", currentRevision: 0 });
    expect(commit).not.toHaveBeenCalled();
    expect(requestPrint).not.toHaveBeenCalled();
  });

  it("does not report readiness when a registration fails", async () => {
    install((tool) => { if (tool.name === "draft_receipt") throw new Error("unsupported"); });
    const registration = registerWebMcpTools(backend());
    expect(await registration.ready).toBe(false);
    expect(registration.errors).toEqual(["draft_receipt: unsupported"]);
  });

  it("reports unavailability when no host global exists", () => {
    Object.defineProperty(document, "modelContext", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "modelContext", { configurable: true, value: undefined });
    const registration = registerWebMcpTools(backend());
    expect(registration.available).toBe(false);
    expect(registration.toolNames).toContain("draft_receipt");
  });
});
