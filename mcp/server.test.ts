// @vitest-environment node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const bundle = resolve(process.cwd(), "dist-mcp/server.mjs");
const built = existsSync(bundle);

/**
 * Drives the real server over stdio with the real client, so the protocol surface is
 * checked end to end rather than by reading the registration code. Needs `npm run
 * build:mcp` first, which `npm run check` does.
 */
describe.skipIf(!built)("MCP server over stdio", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ name: "petes-printer-tests", version: "0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [bundle] }));
  }, 30_000);

  afterAll(async () => { await client?.close(); });

  it("exposes the same tools the browser registers, plus the headless-only pair", async () => {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "get_app_status", "get_receipt", "list_receipt_blocks", "list_receipt_recipes",
      "list_receipt_templates", "draft_receipt", "edit_receipt", "rename_receipt",
      "save_receipt_template", "load_receipt_template", "preview_receipt", "undo_agent_edit",
      "request_receipt_print", "open_receipt_editor", "get_print_job_status", "open_in_browser",
    ]));
  });

  it("publishes an input schema for the one-shot drafting tool", async () => {
    const draft = (await client.listTools()).tools.find((tool) => tool.name === "draft_receipt");
    expect(draft?.inputSchema).toMatchObject({ type: "object" });
    expect(Object.keys((draft?.inputSchema as { properties: Record<string, unknown> }).properties)).toEqual(expect.arrayContaining(["title", "blocks", "dryRun"]));
  });

  it("offers the verbal cues as prompts", async () => {
    const names = (await client.listPrompts()).prompts.map((prompt) => prompt.name);
    expect(names).toEqual(expect.arrayContaining(["travel_receipt", "daily_brief", "reminder", "packing_list", "meeting_notes", "grocery_run"]));
    const prompt = await client.getPrompt({ name: "travel_receipt", arguments: { destination: "Lisbon", when: "Thursday" } });
    expect(prompt.messages[0].content).toMatchObject({ type: "text" });
    expect((prompt.messages[0].content as { text: string }).text).toContain("Lisbon");
  });

  it("serves the situations as a resource", async () => {
    const uris = (await client.listResources()).resources.map((resource) => resource.uri);
    expect(uris).toContain("receipt://recipes");
    const read = await client.readResource({ uri: "receipt://recipes" });
    expect(JSON.parse((read.contents[0] as { text: string }).text).map((recipe: { id: string }) => recipe.id)).toContain("travel_prep");
  });

  it("matches a spoken situation to the trip recipe without touching the bridge", async () => {
    const result = await client.callTool({ name: "list_receipt_recipes", arguments: { situation: "I'm flying to Lisbon on an international flight Thursday" } });
    expect((result.structuredContent as { matched: string[] }).matched).toContain("travel_prep");
  });
});
