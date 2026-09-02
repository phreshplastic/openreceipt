/**
 * Captures the stills the Devpost entry needs, at 2x, from the running app rather than
 * from a mockup. Re-run it after any interface change so the entry never shows a build
 * that no longer exists.
 *
 *   node scripts/serve-public.mjs                 # public site on :4174
 *   PETES_PRINTER_TRANSPORT=dummy petes-printer   # bridge on :8731
 *   npm run dev                                   # local app
 *   node scripts/capture-stills.mjs [--local http://localhost:5173] [--out docs/stills]
 *
 * Chrome must be installed, or set PLAYWRIGHT_CHANNEL to a channel Playwright has.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const publicUrl = arg("public", "http://127.0.0.1:4174");
const localUrl = arg("local", "http://localhost:5173");
const out = arg("out", "docs/stills");

const LISBON = {
  title: "Lisbon",
  blocks: [
    { type: "heading", text: "LISBON" },
    { type: "text", text: "Thursday · international" },
    { type: "rule" },
    { type: "facts", rows: [{ label: "Flight", value: "TP204 · 09:40" }, { label: "Terminal", value: "5" }, { label: "Seat", value: "14A" }] },
    { type: "groups", title: "Packing", groups: [
      { name: "Carry-on", items: [{ text: "Passport" }, { text: "Adapter" }, { text: "Headphones" }] },
      { name: "Before the door", items: [{ text: "Bins out" }, { text: "Thermostat down" }] },
    ] },
  ],
};

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png` });
  process.stdout.write(`${out}/${name}.png\n`);
};
const callTool = (name, input = {}) => page.evaluate(async ({ name, input }) => {
  const result = await window.__webmcpShim.call(name, input);
  return { text: String(result), data: result.structuredContent };
}, { name, input });

// 1. The landing page, scrolled past the hero so the shader field has loaded.
await page.goto(publicUrl, { waitUntil: "networkidle" });
await shot("01-landing");
await page.locator(".how-demo-root").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(4000);
await shot("02-how-it-works");

// 2. The editor, holding a receipt an agent drafted through the tools.
await page.goto(`${localUrl}/app`, { waitUntil: "networkidle" });
// The stills show the product, not the scaffolding: the first-visit card is a one-time
// prompt, and the shim launcher only exists because these runs have no real WebMCP host.
await page.addStyleTag({ content: "#webmcp-shim{display:none!important}" });
await page.evaluate(() => localStorage.setItem("petes-printer:first-visit-welcome:v1", "1"));
await page.reload({ waitUntil: "networkidle" });
await page.addStyleTag({ content: "#webmcp-shim{display:none!important}" });
await page.waitForTimeout(1500);
const before = await callTool("get_receipt");
await callTool("draft_receipt", { expectedRevision: before.data.revision, ...LISBON });
await page.waitForTimeout(1200);
await shot("03-editor-agent-draft");

// 3. The approval panel — the whole argument in one frame.
const drafted = await callTool("get_receipt");
await page.evaluate((revision) => {
  void window.__webmcpShim.call("request_receipt_print", { expectedRevision: revision, reason: "Packing list for the Lisbon trip" });
}, drafted.data.revision);
await page.waitForSelector("text=Approve and print");
await page.waitForTimeout(600);
await shot("04-approval");

// 4. What the printer is actually sent, at its real dot width.
await page.getByRole("button", { name: "Approve and print" }).click();
await page.waitForTimeout(3500);
await shot("05-printed");

await browser.close();
