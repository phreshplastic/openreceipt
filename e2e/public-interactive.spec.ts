import { expect, test } from "@playwright/test";

test("opens the real browser editor without a local API", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/")) apiRequests.push(request.url()); });

  await page.goto("/");
  await page.getByRole("link", { name: "Start a receipt" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("button", { name: "Save as, saved" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print destination, Demo print" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Print destination/ }).locator(".status-dot")).toHaveClass(/online/);
  await expect(page.getByRole("button", { name: "Demo print", exact: true })).toBeVisible();
  await expect(page.getByText("This is a real receipt.", { exact: true }).last()).toBeVisible();

  await page.getByRole("button", { name: "Select heading block" }).first().click();
  await page.getByRole("textbox", { name: "Edit heading" }).fill("BROWSER RECEIPT");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Edit heading" })).toHaveCount(0);
  await page.getByRole("button", { name: "Select heading block" }).first().click();
  await expect(page.getByRole("textbox", { name: "Edit heading" })).toHaveValue("BROWSER RECEIPT");
  expect(apiRequests).toEqual([]);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Demo print", exact: true }).click();
  await expect(page.getByRole("button", { name: "Printing" })).toBeDisabled();
  await expect(page.locator(".print-pixel-grid")).toBeVisible();
  await expect(page.locator(".receipt-shell")).not.toHaveClass(/is-feeding/);
  expect(page.context().pages()).toHaveLength(1);
  const popup = await popupPromise;
  await expect(popup.locator("svg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Demo print", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Print destination/ }).click();
  const destinations = page.getByRole("menu", { name: "Print destination" }).getByRole("menuitemradio");
  await expect(destinations.nth(0)).toHaveAccessibleName(/Demo print/);
  await expect(destinations.nth(1)).toHaveAccessibleName(/Epson printer/);
  await expect(page.getByRole("menuitemradio", { name: /Demo print/ }).locator(".status-dot")).toHaveClass(/online/);
  await expect(page.getByRole("menuitemradio", { name: /Epson printer/ }).locator(".status-dot")).toHaveClass(/offline/);
  await page.getByRole("menuitemradio", { name: /Epson printer/ }).click();
  await expect(page.getByRole("button", { name: /Print destination/ }).locator(".status-dot")).toHaveClass(/offline/);
  await expect(page.getByRole("button", { name: "Print", exact: true })).toBeDisabled();
});

test("personalizes the printer and curates the library without replacing the receipt", async ({ page }) => {
  await page.goto("/app");
  const title = await page.getByRole("textbox", { name: "Receipt title" }).first().inputValue();
  await page.getByRole("button", { name: "Make it mine" }).first().click();
  await page.getByLabel("First name").fill("Maya");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Daily briefings/ }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByLabel("OpenReceipt").first()).toBeVisible();
  await expect(page.getByText("For you", { exact: true })).toBeVisible();
  await expect(page.getByText("Daily weather", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue(title);
});
