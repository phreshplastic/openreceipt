import { expect, test } from "@playwright/test";

const capabilities = {
  connected: true,
  adapter: "dummy",
  model: "Dummy file transport",
  transport: "dummy",
  cutModes: ["full", "partial"],
  configuredProfileId: "80mm-576",
  profiles: [
    { id: "80mm-576", label: "80 mm · 576 dots", paperWidthMm: 80, printableWidthDots: 576, paddingDots: 28 },
    { id: "58mm-420", label: "58 mm · 420 dots", paperWidthMm: 58, printableWidthDots: 420, paddingDots: 22 },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/capabilities", (route) => route.fulfill({ json: capabilities }));
  await page.route("**/api/v1/configuration", (route) => route.fulfill({ json: capabilities }));
});

test("landing, setup, and receipt-first editing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Make a little something/i })).toBeVisible();
  await page.getByRole("button", { name: /Set up your printer/i }).click();
  await expect(page.getByRole("heading", { name: /Set up the local printer/i })).toBeVisible();
  await page.getByRole("button", { name: /58 mm/i }).click();
  await page.getByRole("button", { name: /Finish setup/i }).click();
  await expect(page.getByText(/420 ×/)).toBeVisible();
  await page.getByRole("button", { name: "Select heading block" }).click();
  const editor = page.getByRole("textbox", { name: "Edit heading" });
  await editor.fill("A RECEIPT MADE TOGETHER");
  await expect(editor).toHaveValue("A RECEIPT MADE TOGETHER");
});

test("opens the focused template and settings overlays", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /Templates/i }).click();
  await expect(page.getByRole("dialog", { name: "Templates" })).toBeVisible();
  await page.getByRole("button", { name: /Checklist/i }).click();
  await expect(page.getByRole("textbox", { name: "Receipt title" })).toHaveValue("Packing list");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: /Approved automations/i }).click();
  await expect(page.getByText("Approved template revisions")).toBeVisible();
});
