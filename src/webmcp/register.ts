import { z } from "zod";
import { createAgentTools, runAgentTool, type AgentBackend, type AgentToolDefinition } from "../agent";

export type { AgentActivity, AgentPhase, AgentAppStatus, AgentBackend } from "../agent";

type ToolContext = { signal?: AbortSignal };

type RegisteredTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown, context?: ToolContext): unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool(tool: RegisteredTool, options?: { signal?: AbortSignal }): Promise<void> | void;
};

type ModelContextHost = { modelContext?: ModelContext };

/**
 * WebMCP is mid-migration: the Chrome 149 origin trial shipped `navigator.modelContext`
 * while the explainer has moved to `document.modelContext`. Accept either, preferring the
 * newer location, so the same build works across the trial window.
 */
export function findModelContext(): ModelContext | undefined {
  const fromDocument = typeof document === "undefined" ? undefined : (document as Document & ModelContextHost).modelContext;
  if (fromDocument) return fromDocument;
  return typeof navigator === "undefined" ? undefined : (navigator as Navigator & ModelContextHost).modelContext;
}

function toRegisteredTool(tool: AgentToolDefinition, backend: AgentBackend): RegisteredTool {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
    annotations: { readOnlyHint: tool.readOnly, untrustedContentHint: tool.untrustedContent },
    async execute(input, context) {
      const result = await runAgentTool(tool, input ?? {}, backend, context?.signal);
      // Chrome documents `execute` as returning a string; the explainer returns content
      // blocks. Return both shapes so either host reads something sensible.
      return {
        content: [{ type: "text", text: result.text }],
        structuredContent: result.data,
        isError: result.isError ?? false,
        toString: () => result.text,
      };
    },
  };
}

export type WebMcpRegistration = {
  available: boolean;
  ready: Promise<boolean>;
  errors: string[];
  toolNames: string[];
  dispose(): void;
};

export function registerWebMcpTools(backend: AgentBackend): WebMcpRegistration {
  const modelContext = findModelContext();
  const tools = createAgentTools(backend);
  if (!modelContext) return { available: false, ready: Promise.resolve(false), errors: [], toolNames: tools.map((tool) => tool.name), dispose() {} };

  const controller = new AbortController();
  const errors: string[] = [];

  const ready = Promise.all(tools.map(async (tool) => {
    try {
      await modelContext.registerTool(toRegisteredTool(tool, backend), { signal: controller.signal });
    } catch (error) {
      errors.push(`${tool.name}: ${error instanceof Error ? error.message : "registration failed"}`);
      throw error;
    }
  })).then(() => true).catch(() => {
    controller.abort();
    return false;
  });

  return { available: true, ready, errors, toolNames: tools.map((tool) => tool.name), dispose: () => controller.abort() };
}
