import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** The landing copy lives in content/site.json; read it so these assertions cannot drift from it. */
const site = JSON.parse(readFileSync(new URL("../content/site.json", import.meta.url), "utf8"));

test.use({ javaScriptEnabled: false });

const guides = [
  ["/guides/best-thermal-printer-for-ai-projects", "What kind of printer should you get for an AI project?"],
  ["/guides/epson-tm-l90-ai-printer-setup", "Set up an Epson TM-L90 with OpenReceipt"],
  ["/guides/58mm-vs-80mm-thermal-paper", "How to choose thermal paper: width, weight, and phenol-free rolls"],
  ["/guides/how-ai-agents-print-with-webmcp", "How an AI agent gets a receipt onto paper"],
] as const;

test("serves the landing page and every guide without JavaScript", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: site.hero.heading })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try it in your browser" }).first()).toHaveAttribute("href", "/app");

  for (const [path, title] of guides) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://example.test${path}`);
  }
});

test("serves discovery formats, private noindex pages, and a genuine 404", async ({ request }) => {
  const markdown = await request.get("/guides/epson-tm-l90-ai-printer-setup.md");
  expect(markdown.ok()).toBe(true);
  expect(markdown.headers()["content-type"]).toContain("text/markdown");
  expect(await markdown.text()).toContain("canonical_url: https://example.test/guides/epson-tm-l90-ai-printer-setup");

  for (const path of ["/app", "/setup", "/blocks", "/blocks/charts"]) {
    const privatePage = await request.get(path);
    expect(privatePage.ok()).toBe(true);
    expect(await privatePage.text()).toContain('name="robots" content="noindex,nofollow"');
  }

  const privateApi = await request.get("/api/v1/receipt");
  expect(privateApi.status()).toBe(404);
  expect(await privateApi.text()).toContain('name="robots" content="noindex,nofollow"');

  const missing = await request.get("/nothing-on-this-roll");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("That page is not on this roll.");
});
