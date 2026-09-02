import { describe, expect, it } from "vitest";
import { webMcpToolCatalog } from "./tool-catalog";
import { createAgentTools, type AgentBackend } from "./tools";

const unused = () => {
  throw new Error("catalog comparison does not execute tools");
};

const backend: AgentBackend = {
  getState: unused,
  commit: unused,
  requestPrint: unused,
  status: unused,
};

describe("WebMCP tool catalog", () => {
  it("lists the same tools the page registers, in the same order", () => {
    const tools = createAgentTools(backend);
    expect(webMcpToolCatalog.map((tool) => tool.name)).toEqual(tools.map((tool) => tool.name));
    expect(webMcpToolCatalog.map((tool) => tool.title)).toEqual(tools.map((tool) => tool.title));
    expect(webMcpToolCatalog.map((tool) => tool.readOnly)).toEqual(tools.map((tool) => tool.readOnly));
  });
});
