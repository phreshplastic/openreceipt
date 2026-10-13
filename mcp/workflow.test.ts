// @vitest-environment node
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const baseUrl = "http://127.0.0.1:8751";
const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
const directory = mkdtempSync(`${tmpdir()}/openreceipt-workflow-`);
let bridge: ChildProcess;
let http: ChildProcess;
let token: string;
const clients: Client[] = [];

async function stdio() {
  const client = new Client({ name: "workflow", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve("dist-mcp/server.mjs")], env: { ...process.env, PETES_PRINTER_URL: baseUrl, PETES_PRINTER_TOKEN: token } as Record<string, string> }));
  clients.push(client);
  return client;
}

describe("persistent MCP workflow against the real bridge", () => {
  beforeAll(async () => {
    const python = resolve("bridge/.venv/bin/python");
    token = execFileSync(python, ["-c", "from pathlib import Path; import sys; from petes_printer_bridge.storage import BridgeStore; s=BridgeStore(Path(sys.argv[1])); _,t=s.create_token('test',['receipt:read','receipt:write','print:request','print:status','print:automatic']); s.connection.execute(\"update app_settings set print_policy='autonomous', initialized=1, configured=1\"); s.connection.commit(); print(t); s.close()", directory], { encoding: "utf8" }).trim();
    bridge = spawn(python, ["-m", "petes_printer_bridge.cli", "--port", "8751", "--data-dir", directory], { stdio: "ignore", env: { ...process.env, PETES_PRINTER_TRANSPORT: "dummy", PETES_PRINTER_RENDER_PORT: "8754", PETES_PRINTER_RENDER_URL: "http://127.0.0.1:8754" } });
    for (let i = 0; i < 100; i++) {
      if (await fetch(`${baseUrl}/healthz`).then((response) => response.ok).catch(() => false)) break;
      await delay(50);
    }
    http = spawn(process.execPath, [resolve("dist-mcp/server.mjs"), "--http", "--port", "8753"], { stdio: "ignore", env: { ...process.env, PETES_PRINTER_URL: baseUrl } });
    for (let i = 0; i < 100; i++) {
      if (await fetch("http://127.0.0.1:8753/mcp").then((response) => response.status === 401).catch(() => false)) break;
      await delay(50);
    }
  }, 15000);

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.close()));
    http?.kill(); bridge?.kill();
  });

  it("edits the same saved list from independent clients, previews an image and prints once", async () => {
    const first = await stdio();
    const second = await stdio();
    const selected = await first.callTool({ name: "select_receipt", arguments: { title: "Market run" } });
    expect(selected.isError, JSON.stringify(selected.content)).not.toBe(true);
    const receiptId = (selected.structuredContent as { receiptId: string }).receiptId;
    const drafted = await first.callTool({ name: "draft_receipt", arguments: { receiptId, title: "Market run", blocks: [{ type: "heading", text: "Shopping" }, { type: "list", items: ["Milk", "Eggs"] }] } });
    expect(drafted.isError).not.toBe(true);
    const receipts = await second.callTool({ name: "list_receipts", arguments: {} });
    expect((receipts.structuredContent as { receipts: { title: string }[] }).receipts.map((item) => item.title)).toContain("Market run");
    const read = await second.callTool({ name: "get_receipt", arguments: { receiptId, detail: "text" } });
    expect(read.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "text", text: expect.stringContaining("Milk") })]));
    const edited = await second.callTool({ name: "edit_receipt", arguments: { receiptId, expectedRevision: (read.structuredContent as { revision: number }).revision, operations: [{ op: "addItem", at: 2, text: "Apples" }] } });
    expect(edited.isError).not.toBe(true);
    const jobsBeforePrint = await fetch(`${baseUrl}/api/v1/print-requests`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json());
    expect(jobsBeforePrint.items).toHaveLength(0);
    const preview = await second.callTool({ name: "preview_receipt", arguments: { receiptId } });
    expect(preview.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "image", mimeType: "image/png" })]));
    const state = await fetch(`${baseUrl}/api/v1/receipts/${receiptId}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json());
    const browserArtifact = await fetch(`${baseUrl}/api/v1/render`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ document: state.document }) }).then((response) => response.json());
    expect(preview.content.find((item) => item.type === "image")).toMatchObject({ data: browserArtifact.previewPng });
    expect(preview.structuredContent).toMatchObject({ checksum: browserArtifact.checksum });
    const revision = (preview.structuredContent as { revision: number }).revision;
    const requestId = crypto.randomUUID();
    const printed = await first.callTool({ name: "request_receipt_print", arguments: { receiptId, expectedRevision: revision, requestId } });
    expect(printed.structuredContent).toMatchObject({ status: "succeeded", jobId: requestId });
    const replay = await second.callTool({ name: "request_receipt_print", arguments: { receiptId, expectedRevision: revision, requestId } });
    expect(replay.structuredContent).toMatchObject({ status: "succeeded", jobId: requestId });
    const laterEdit = await second.callTool({ name: "edit_receipt", arguments: { receiptId, expectedRevision: revision, operations: [{ op: "addItem", at: 2, text: "Bread" }] } });
    expect(laterEdit.isError).not.toBe(true);
    const replayAfterEdit = await first.callTool({ name: "request_receipt_print", arguments: { receiptId, expectedRevision: revision, requestId } });
    expect(replayAfterEdit.structuredContent).toMatchObject({ status: "succeeded", jobId: requestId });
    const wrongRevision = await second.callTool({ name: "request_receipt_print", arguments: { receiptId, expectedRevision: revision + 1, requestId } });
    expect(wrongRevision.structuredContent).toMatchObject({ status: "failed", jobId: requestId });
    const jobsAfterRetries = await fetch(`${baseUrl}/api/v1/print-requests`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json());
    expect(jobsAfterRetries.items).toHaveLength(1);
    const templates = await first.callTool({ name: "save_receipt_template", arguments: { receiptId, name: "Market template" } });
    expect(templates.isError).not.toBe(true);
    const saved = await second.callTool({ name: "list_receipt_templates", arguments: {} });
    expect((saved.structuredContent as { templates: { name: string }[] }).templates.map((item) => item.name)).toContain("Market template");
  }, 15000);

  it("authenticates independent HTTP clients without sharing sessions", async () => {
    expect((await fetch("http://127.0.0.1:8753/mcp")).status).toBe(401);
    for (let i = 0; i < 2; i++) {
      const client = new Client({ name: `http-${i}`, version: "1" });
      await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:8753/mcp"), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
      clients.push(client);
      expect((await client.listTools()).tools.map((tool) => tool.name)).toContain("list_receipts");
    }
  });
});
