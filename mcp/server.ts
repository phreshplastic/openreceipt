import { z } from "zod";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer, WebStandardStreamableHTTPServerTransport, fromJsonSchema, localhostAllowedHostnames, localhostAllowedOrigins } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createAgentTools, recipes, renderReceiptText, runAgentTool, type AgentToolDefinition } from "../src/agent";
import { BridgeBackend } from "./bridge-client";

const NAME = "openreceipt";
const VERSION = "0.3.0";

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
      "OpenReceipt turns a described situation into a receipt on an 80mm thermal printer.",
      "When someone describes a moment rather than naming blocks — travelling, a morning, a shopping trip — call list_receipt_recipes first, ask only for details you genuinely need, then draft_receipt in one call.",
      "Use setCopy on edit_receipt to change heading or text wording without replacing the block. save_receipt_template keeps a named starting point in shared storage; load_receipt_template brings a built-in or saved template onto the targeted receipt.",
      "For persistent lists, list_receipts first and pass receiptId on every read, edit, preview, and print. select_receipt can create a new named receipt without replacing the editor. Adding an item never prints. Preview before a requested print, and reuse requestId if a print call must be retried. Trusted credentials may print automatically; get_app_status reports the effective policy. Never resubmit a queued or unknown job.",
      "preview_receipt returns the actual paper layout as a smooth PNG. Show that image when supported; otherwise link editorUrl so the person can review the exact paper layout. Do not replace the preview with an ASCII approximation.",
    ].join(" "),
  });

  const register = (tool: AgentToolDefinition) => {
    const schema = tool.inputSchema as z.ZodObject;
    const scopedSchema = schema.extend({ receiptId: z.string().uuid().optional(), ...(tool.name === "request_receipt_print" ? { requestId: z.string().uuid().optional() } : {}) });
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: fromJsonSchema(z.toJSONSchema(scopedSchema) as Record<string, unknown>),
      annotations: { readOnlyHint: tool.readOnly, destructiveHint: tool.name === "request_receipt_print", idempotentHint: tool.readOnly, openWorldHint: tool.untrustedContent },
    }, async (input: unknown) => {
      const { receiptId, requestId, ...args } = scopedSchema.parse(input ?? {}) as { receiptId?: string; requestId?: string; [key: string]: unknown };
      const scoped = backend.forReceipt(receiptId, requestId);
      if (tool.name === "preview_receipt") {
        const snapshot = await scoped.getState();
        scoped.getState = async () => snapshot;
      }
      const definition = createAgentTools(scoped).find((candidate) => candidate.name === tool.name)!;
      const result = await runAgentTool(definition, args, scoped);
      const content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] = [{ type: "text", text: result.text }];
      if (tool.name === "preview_receipt" && !result.isError) {
        const preview = await scoped.preview();
        content.push({ type: "image", data: preview.previewPng, mimeType: "image/png" });
        result.data.checksum = preview.checksum;
        result.data.editorUrl = scoped.editorUrl;
      }
      return { content, structuredContent: result.data, isError: result.isError ?? false };
    });
  };

  for (const tool of createAgentTools(backend)) register(tool);

  server.registerTool("list_receipts", { description: "Find saved receipts and lists across chats. Returns receiptId, title and revision. Never prints.", inputSchema: z.object({}).strict(), annotations: { readOnlyHint: true } }, async () => {
    const { items } = await backend.listReceipts();
    const receipts = items.map((item) => ({ receiptId: item.document.id, title: item.document.title, revision: item.revision, updatedAt: item.updatedAt }));
    return { content: [{ type: "text", text: JSON.stringify(receipts) }], structuredContent: { receipts } };
  });
  server.registerTool("select_receipt", { description: "Read a saved receipt by ID, or create a named receipt by supplying title. Returns receiptId to pass to subsequent tools; does not change the receipt open in the editor.", inputSchema: z.object({ receiptId: z.string().uuid().optional(), title: z.string().min(1).max(160).optional() }).strict(), annotations: { readOnlyHint: false } }, async ({ receiptId, title }) => {
    if (!receiptId && !title) throw new Error("Supply receiptId or title.");
    if (receiptId && !(await backend.listReceipts()).items.some((item) => item.document.id === receiptId)) throw new Error("Receipt not found. Use list_receipts to choose an existing receipt.");
    const id = receiptId ?? crypto.randomUUID();
    const scoped = backend.forReceipt(id, undefined, !receiptId);
    let state = await scoped.getState();
    if (!receiptId && title) state = await scoped.commit(state.revision, { ...state.document, title, blocks: [{ id: crypto.randomUUID(), type: "heading", text: title, level: "heading", weight: "bold", italic: false, underline: false, align: "left" }] }, "Created a named receipt");
    return { content: [{ type: "text", text: `Receipt ${state.document.title}: ${id}, revision ${state.revision}. Pass this receiptId to subsequent tools.` }], structuredContent: { receiptId: id, revision: state.revision, document: state.document } };
  });

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
  const node = createHttpServer((incoming: IncomingMessage, outgoing: ServerResponse) => {
    void (async () => {
      if (incoming.url !== "/mcp") { outgoing.writeHead(404).end(); return; }
      const authorization = incoming.headers.authorization;
      if (!authorization?.startsWith("Bearer ")) { outgoing.writeHead(401, { "WWW-Authenticate": "Bearer" }).end(); return; }
      const scopedBackend = backend.forToken(authorization.slice(7));
      try { await scopedBackend.status(); } catch { outgoing.writeHead(401).end(); return; }
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableDnsRebindingProtection: true,
        allowedHosts: [...localhostAllowedHostnames().flatMap((host) => [host, `${host}:${port}`]), ...(process.env.PETES_PRINTER_MCP_ALLOWED_HOSTS ?? "").split(",").filter(Boolean)],
        allowedOrigins: [...localhostAllowedOrigins(), ...(process.env.PETES_PRINTER_MCP_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean)],
      });
      await createServer(scopedBackend).connect(transport);
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 1_000_000) { outgoing.writeHead(413).end(); await transport.close(); return; }
        chunks.push(chunk as Buffer);
      }
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
      if (!response.body) { outgoing.end(); await transport.close(); return; }
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) outgoing.write(chunk);
      outgoing.end();
      await transport.close();
    })().catch((error) => {
      outgoing.writeHead(500, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed." }));
    });
  });

  await new Promise<void>((resolve) => node.listen(port, process.env.PETES_PRINTER_MCP_HOST ?? "127.0.0.1", resolve));
  process.stderr.write(`OpenReceipt MCP listening on http://127.0.0.1:${port}\n`);
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
