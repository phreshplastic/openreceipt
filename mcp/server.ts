import { z } from "zod";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer, WebStandardStreamableHTTPServerTransport, fromJsonSchema, localhostAllowedHostnames, localhostAllowedOrigins } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createAgentTools, recipes, renderReceiptText, runAgentTool, type AgentToolDefinition } from "../src/agent";
import { BridgeBackend } from "./bridge-client";

const NAME = "petes-printer";
const VERSION = "0.2.0";

/**
 * Prompts are the verbal cues made first-class: the phrases someone actually says, turned
 * into slash commands the host can offer. Each one hands the model the situation and lets
 * `list_receipt_recipes` supply the shape.
 */
const promptArguments = {
  travel_receipt: z.object({ destination: z.string().describe("Where you are going"), when: z.string().describe("When you leave, in whatever words you'd use") }),
  daily_brief: z.object({ city: z.string().describe("City for the forecast") }),
  reminder: z.object({ what: z.string().describe("What to remember"), when: z.string().optional().describe("When it matters") }),
  packing_list: z.object({ trip: z.string().describe("The trip, e.g. four days in Lisbon, carry-on only") }),
  meeting_notes: z.object({ topic: z.string().describe("What the meeting is about"), who: z.string().optional().describe("Who is in it") }),
  grocery_run: z.object({ meals: z.string().describe("What you plan to cook, or the list as you'd say it") }),
} as const;

const promptText: Record<keyof typeof promptArguments, (args: Record<string, string | undefined>) => string> = {
  travel_receipt: (a) => `I'm travelling to ${a.destination}, leaving ${a.when}. Call list_receipt_recipes with that situation, ask me only for details you genuinely need, then draft a receipt with a countdown, the flight facts, the weather at ${a.destination}, and a packing list grouped by where things live. Show me the preview before printing.`,
  daily_brief: (a) => `Draft my morning brief for ${a.city}: the forecast, whatever I tell you is on today, a habit grid, and one line of news. Keep it under an arm's length of paper.`,
  reminder: (a) => `Draft a reminder to ${a.what}${a.when ? `, for ${a.when}` : ""}. Big enough to read across a room. Don't print it until I say so.`,
  packing_list: (a) => `Draft a packing list for ${a.trip}, grouped by carry-on, clothes, toiletries and before-the-door. Use the groups block, not a flat list.`,
  meeting_notes: (a) => `Draft a meeting receipt about ${a.topic}${a.who ? ` with ${a.who}` : ""}: the facts at the top, an agenda as a list, and a blank meetingNotes form underneath to write on during the meeting.`,
  grocery_run: (a) => `Draft a shopping list for ${a.meals}, grouped by aisle so the list matches the walk through the store.`,
};

export function createServer(backend: BridgeBackend) {
  const server = new McpServer({ name: NAME, version: VERSION }, {
    capabilities: { tools: {}, prompts: {}, resources: {} },
    instructions: [
      "Pete's Printer turns a described situation into a receipt on an 80mm thermal printer.",
      "When someone describes a moment rather than naming blocks — travelling, a morning, a shopping trip — call list_receipt_recipes first, ask only for details you genuinely need, then draft_receipt in one call.",
      "After drafting, tell them the editor URL from get_app_status so they can see and adjust it. Printing is consequential: it may wait for them to tap approve in that browser tab.",
    ].join(" "),
  });

  const register = (tool: AgentToolDefinition) => {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: fromJsonSchema(z.toJSONSchema(tool.inputSchema) as Record<string, unknown>),
      annotations: { readOnlyHint: tool.readOnly, destructiveHint: tool.name === "request_receipt_print", idempotentHint: tool.readOnly, openWorldHint: tool.untrustedContent },
    }, async (input: unknown) => {
      const result = await runAgentTool(tool, input ?? {}, backend);
      return { content: [{ type: "text" as const, text: result.text }], structuredContent: result.data, isError: result.isError ?? false };
    });
  };

  for (const tool of createAgentTools(backend)) register(tool);

  // Headless-only additions: the browser resolves these through its own UI.
  server.registerTool("get_print_job_status", {
    title: "Check a print job",
    description: "Reports where a print job you submitted ended up. Use this to answer “did it print?” after a request that was waiting for approval.",
    inputSchema: fromJsonSchema(z.toJSONSchema(z.object({ jobId: z.string().min(1).max(80) }).strict()) as Record<string, unknown>),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async (input: unknown) => {
    const { jobId } = z.object({ jobId: z.string() }).parse(input);
    try {
      const job = await backend.getPrintJob(jobId);
      return { content: [{ type: "text" as const, text: `Job ${job.id} is ${job.status}${job.error ? ` — ${job.error}` : ""}.` }], structuredContent: { status: "ok", job } };
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "The job could not be read." }], structuredContent: { status: "error" }, isError: true };
    }
  });

  server.registerTool("open_in_browser", {
    title: "Open the editor",
    description: "Returns the URL of the visible receipt editor and opens it in the default browser when the host allows it. The open tab updates itself, so anything you drafted is already on screen.",
    inputSchema: fromJsonSchema(z.toJSONSchema(z.object({}).strict()) as Record<string, unknown>),
    annotations: { readOnlyHint: false },
  }, async () => {
    let opened = false;
    try {
      const { spawn } = await import("node:child_process");
      const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      spawn(command, [backend.editorUrl], { detached: true, stdio: "ignore" }).unref();
      opened = true;
    } catch { /* headless hosts simply get the URL back */ }
    return {
      content: [{ type: "text" as const, text: `${opened ? "Opened" : "The editor is at"} ${backend.editorUrl}. Anything you drafted is already showing there.` }],
      structuredContent: { status: "ok", editorUrl: backend.editorUrl, opened },
    };
  });

  for (const [name, argsSchema] of Object.entries(promptArguments)) {
    server.registerPrompt(name, {
      title: name.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
      description: `Draft a receipt for: ${name.replace(/_/g, " ")}.`,
      argsSchema: argsSchema as never,
    }, ((args: Record<string, string | undefined>) => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: promptText[name as keyof typeof promptArguments](args) } }],
    })) as never);
  }

  server.registerResource("recipes", "receipt://recipes", {
    title: "Receipt situations",
    description: "The situations this printer knows how to lay out, and what to ask before drafting each one.",
    mimeType: "application/json",
  }, async (uri: URL) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(recipes, null, 2) }] }));

  server.registerResource("current-receipt", "receipt://current", {
    title: "Current receipt",
    description: "The receipt on screen right now, as the plain text that will be printed.",
    mimeType: "text/plain",
  }, async (uri: URL) => {
    const state = await backend.getState();
    return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `Revision ${state.revision}\n\n${renderReceiptText(state.document)}` }] };
  });

  return server;
}

/**
 * Streamable HTTP for hosts that connect over a URL rather than spawning a process.
 * Loopback only, with the SDK's host and origin checks on, so a page in the browser
 * cannot reach a printer through it.
 */
async function serveHttp(backend: BridgeBackend, port: number) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableDnsRebindingProtection: true,
    // The Host header carries the port, so allow the bare and port-qualified forms.
    allowedHosts: localhostAllowedHostnames().flatMap((host) => [host, `${host}:${port}`]),
    allowedOrigins: localhostAllowedOrigins(),
  });
  await createServer(backend).connect(transport);

  const node = createHttpServer((incoming: IncomingMessage, outgoing: ServerResponse) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(chunk as Buffer);
      const url = new URL(incoming.url ?? "/", `http://${incoming.headers.host ?? `127.0.0.1:${port}`}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (typeof value === "string") headers.set(key, value);
        else if (Array.isArray(value)) for (const entry of value) headers.append(key, entry);
      }
      const method = incoming.method ?? "GET";
      const body = method === "GET" || method === "HEAD" || !chunks.length ? undefined : Buffer.concat(chunks);
      const response = await transport.handleRequest(new Request(url, { method, headers, body }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (!response.body) return outgoing.end();
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) outgoing.write(chunk);
      outgoing.end();
    })().catch((error) => {
      outgoing.writeHead(500, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed." }));
    });
  });

  await new Promise<void>((resolve) => node.listen(port, "127.0.0.1", resolve));
  process.stderr.write(`Pete's Printer MCP listening on http://127.0.0.1:${port}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const backend = new BridgeBackend();
  if (!argv.includes("--http")) return createServer(backend).connect(new StdioServerTransport());
  const portFlag = argv.indexOf("--port");
  await serveHttp(backend, portFlag >= 0 ? Number(argv[portFlag + 1]) : 8733);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("server.mjs") || entry.endsWith("server.ts")) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
}
