import { expect, test, type Page } from "@playwright/test";

const TOOL_NAMES = [
  "get_app_status",
  "get_receipt",
  "list_receipt_blocks",
  "list_receipt_recipes",
  "draft_receipt",
  "edit_receipt",
  "rename_receipt",
  "preview_receipt",
  "undo_agent_edit",
  "request_receipt_print",
  "open_receipt_editor",
];

declare global {
  interface Window {
    __hostTools?: Map<string, { execute(input: unknown): Promise<{ structuredContent?: Record<string, unknown>; content: { text: string }[] }> }>;
    __printPromise?: Promise<{ structuredContent?: Record<string, unknown>; content: { text: string }[] }>;
  }
}

/**
 * Stands in for the browser's WebMCP host the way Chrome 149+ or an in-app agent browser
 * would provide it. The public build ships no shim, so this is the only way to prove the
 * deployed origin registers real tools rather than only rendering a page.
 */
async function installHost(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map();
    window.__hostTools = tools;
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: (tool: { name: string }) => { tools.set(tool.name, tool); } },
    });
  });
}

const registeredNames = (page: Page) => page.evaluate(() => [...(window.__hostTools?.keys() ?? [])].sort());
const callTool = (page: Page, name: string, input: unknown = {}) =>
  page.evaluate(async ({ name, input }) => {
    const result = await window.__hostTools!.get(name)!.execute(input);
    return { text: result.content[0].text, data: result.structuredContent };
  }, { name, input });

test("registers the full toolset on the public landing page", async ({ page }) => {
  await installHost(page);
  await page.goto("/");
  await expect.poll(() => registeredNames(page)).toEqual([...TOOL_NAMES].sort());

  const status = await callTool(page, "get_app_status");
  expect(status.text).toContain("/app");
  expect(status.text).toContain("offline");
});

test("an agent drafts from the landing page and the editor opens holding the draft", async ({ page }) => {
  await installHost(page);
  await page.goto("/");
  await expect.poll(() => registeredNames(page)).toContain("draft_receipt");

  const drafted = await callTool(page, "draft_receipt", {
    title: "LISBON THURSDAY",
    blocks: [
      { type: "heading", text: "LISBON THURSDAY" },
      { type: "list", items: [{ text: "Passport" }, { text: "Adapter" }] },
    ],
  });
  expect(drafted.text).not.toContain("did not match the schema");
  await callTool(page, "open_receipt_editor");

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("LISBON THURSDAY");
  expect((await callTool(page, "get_receipt")).text).toContain("Passport");
  await expect.poll(() => registeredNames(page)).toEqual([...TOOL_NAMES].sort());
});

test("an agent print waits for approval then opens a demo print", async ({ page }) => {
  await installHost(page);
  await page.goto("/app");
  await expect.poll(() => registeredNames(page)).toContain("request_receipt_print");

  const receipt = await callTool(page, "get_receipt");
  const revision = Number((receipt.data as { revision: number }).revision);

  await page.evaluate((expectedRevision) => {
    window.__printPromise = window.__hostTools!.get("request_receipt_print")!.execute({ expectedRevision });
  }, revision);

  const approval = page.getByRole("dialog", { name: /agent wants to print/i });
  await expect(approval).toBeVisible();
  await expect(approval.getByText("Demo print · this browser")).toBeVisible();
  await expect(page.locator(".agent-cursor")).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Approve and demo print" }).click();
  const popup = await popupPromise;
  await expect(popup.locator("svg")).toBeVisible();

  const result = await page.evaluate(async () => {
    const executed = await window.__printPromise!;
    return { text: executed.content[0].text, data: executed.structuredContent };
  });
  expect(result.data).toMatchObject({ status: "succeeded" });
  expect(result.text).toMatch(/demo print/i);
  expect(result.text).toContain("TM-L90");
  expect(result.text).toMatch(/browser demo/i);
});
