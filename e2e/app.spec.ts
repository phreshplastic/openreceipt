import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** The landing copy lives in content/site.json; read it so these assertions cannot drift from it. */
const site = JSON.parse(readFileSync(new URL("../content/site.json", import.meta.url), "utf8"));

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
  let receipt: Record<string, unknown> | undefined;
  let settings = { revision: 1, initialized: true, configured: true, printPolicy: "confirm", trustedTemplateIds: [] as string[], defaultLocation: "", defaultUnit: "fahrenheit", printerProfile: { completed: false, ownerFirstName: "", identityId: "owners-printer-western", useCaseIds: [] as string[] }, updatedAt: new Date().toISOString() };
  await page.route("**/api/v1/session", (route) => route.fulfill({ json: { csrfToken: "e2e-csrf" } }));
  await page.route("**/api/v1/receipt", async (route) => {
    if (route.request().method() === "GET") {
      if (!receipt) return route.fulfill({ status: 404, json: { error: { code: "receipt_not_initialized", message: "Missing" } } });
      return route.fulfill({ json: receipt });
    }
    const body = route.request().postDataJSON() as { document: unknown; source?: unknown; proposedRevision: number };
    receipt = { document: body.document, source: body.source, revision: body.proposedRevision, checksum: "e2e", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return route.fulfill({ json: receipt });
  });
  await page.route("**/api/v1/settings", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: settings });
    const body = route.request().postDataJSON() as typeof settings;
    settings = { ...settings, ...body, revision: settings.revision + 1, initialized: true, updatedAt: new Date().toISOString() };
    return route.fulfill({ json: settings });
  });
  await page.route("**/api/v1/events**", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ready\n\n" }));
  await page.route("**/api/v1/print-requests?status=awaiting_approval", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/v1/print-requests", (route) => route.request().method() === "GET" ? route.fulfill({ json: { items: [] } }) : route.fallback());
  await page.route("**/api/v1/capabilities", (route) => route.fulfill({ json: capabilities }));
  await page.route("**/api/v1/configuration", (route) => route.fulfill({ json: capabilities }));
});

test("landing opens a receipt-first editor without setup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: site.hero.heading })).toBeVisible();
  await expect(page.locator(".hero-wordmark")).toHaveText(site.name);
  await expect(page.locator(".landing-nav")).not.toHaveClass(/is-visible/);
  const activeMoment = page.locator(".moments-slide.active");
  const before = await activeMoment.getAttribute("data-moment");
  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(activeMoment).not.toHaveAttribute("data-moment", before ?? "");
  await page.getByRole("tab", { name: "This week's dinners" }).click();
  await expect(activeMoment).toHaveAttribute("data-moment", "cook");
  await page.locator(".printer-demo").scrollIntoViewIfNeeded();
  await expect(page.locator(".landing-nav")).toHaveClass(/is-visible/);
  await expect(page.locator(".landing-nav .landing-nav-title")).toHaveText(site.name);
  await expect(page.locator(".landing-nav .button.primary")).toBeVisible();
  await expect(page.locator(".printer-demo-status")).toHaveText("Printer ready.");
  await expect(page.locator(".printer-demo-slot")).toHaveClass(/is-idle/);
  await page.getByRole("button", { name: "Print sample receipt" }).click();
  await expect(page.locator(".printer-demo-slot")).toHaveClass(/is-printed/);
  await page.getByRole("button", { name: "Reprint sample receipt" }).click();
  await expect(page.locator(".printer-demo-slot")).toHaveClass(/is-retracting|is-feeding/);
  await expect(page.locator(".printer-demo-slot")).toHaveClass(/is-printed/);
  await expect(page.getByRole("link", { name: "Launch editor" })).toHaveAttribute("href", "/app");
  await page.locator(".hero-actions .button.primary").click();
  await expect(page.getByRole("button", { name: "Save as, saved" })).toBeVisible();
  await expect(page.getByText("This is a real receipt.", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Select heading block" }).first().click();
  const editor = page.getByRole("textbox", { name: "Edit heading" });
  await editor.fill("A RECEIPT MADE TOGETHER");
  await expect(editor).toHaveValue("A RECEIPT MADE TOGETHER");
  await page.getByRole("button", { name: "Italic" }).click();
  await page.getByRole("button", { name: "Underline" }).click();
  await expect(page.locator('.receipt-svg text[font-style="italic"][text-decoration="underline"]')).not.toHaveCount(0);
  expect(await editor.evaluate((element) => {
    const style = getComputedStyle(element);
    return { border: style.borderTopWidth, padding: style.paddingLeft, outline: style.outlineWidth };
  })).toEqual({ border: "0px", padding: "0px", outline: "0px" });
  await expect(page.locator(".receipt-selection-frame")).toHaveCSS("border-top-style", "dashed");
  await expect(page.locator(".receipt-selection-frame")).toHaveCSS("border-top-width", "1px");
  const paperBottom = await page.locator(".receipt-paper").evaluate((element) => element.getBoundingClientRect().bottom);
  const addTop = await page.getByRole("button", { name: "Add block" }).evaluate((element) => element.getBoundingClientRect().top);
  expect(addTop).toBeGreaterThan(paperBottom);
  await page.getByRole("button", { name: "Add block", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Add block" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Add block" })).toHaveCount(0);
  await expect(page.locator(".editor-header")).toHaveCount(1);
  await expect(page.locator(".canvas-toolbar")).toHaveCount(0);
  await expect(page.locator(".canvas-footer")).toHaveCount(0);
  const rail = page.getByRole("complementary", { name: "Drafts and print queue" });
  await expect(rail).toBeVisible();
  await expect(rail).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await expect(rail.getByText(/WebMCP/i)).toHaveCount(0);
  await expect(rail.getByRole("region", { name: "Print queue" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "New blank" })).toBeVisible();
  await expect(rail.getByRole("button", { name: "New from template" })).toBeVisible();
  const paperWidthBeforeZoom = await page.locator(".receipt-shell").evaluate((element) => element.getBoundingClientRect().width);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByLabel("Receipt preview zoom")).toContainText("110%");
  expect(await page.locator(".receipt-shell").evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(paperWidthBeforeZoom);
  await expect(page.getByLabel("OpenReceipt").first()).toBeVisible();
  await expect(page.locator(".editor-header .brand-icon img")).toBeVisible();
  await expect(page.locator(".editor-header a.brand")).toHaveAttribute("href", "/");
  // The rail has no collapse control any more; it is simply there at this width, and its
  // right border is what the header's leading divider lines up against.
  await expect(page.getByRole("complementary", { name: "Drafts and print queue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Drafts" })).toBeHidden();
  const [dividerLeft, railRight] = await Promise.all([
    page.locator(".wordmark-divider").evaluate((element) => element.getBoundingClientRect().left),
    page.locator(".receipt-rail").evaluate((element) => element.getBoundingClientRect().right),
  ]);
  expect(Math.abs(dividerLeft - railRight)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator(".receipt-shell")).toBeVisible();
  await expect(page.getByLabel("OpenReceipt").first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Drafts and print queue" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Drafts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Templates" })).toBeVisible();
  await page.setViewportSize({ width: 420, height: 800 });
  await expect(page.locator(".receipt-shell")).toBeVisible();
  await expect(page.getByLabel("OpenReceipt").first()).toBeVisible();
});

test("opens every workshop guide from the localhost landing page", async ({ page }) => {
  await page.goto("/guides");
  await expect(page).toHaveURL(/\/guides$/);
  await expect(page.getByRole("heading", { level: 1, name: /Useful notes for putting an AI agent/i })).toBeVisible();

  const guides = [
    "What kind of printer should you get for an AI project?",
    "Set up an Epson TM-L90 with OpenReceipt",
    "How to choose thermal paper: width, weight, and phenol-free rolls",
    "How an AI agent gets a receipt onto paper",
  ];
  for (const title of guides) {
    await page.getByRole("link", { name: title, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Guides", exact: true }).click();
  }
});

test("completes setup with the virtual printer when no hardware is connected", async ({ page }) => {
  await page.unroute("**/api/v1/capabilities");
  await page.route("**/api/v1/capabilities", (route) => route.fulfill({ json: { ...capabilities, connected: false, detail: "The Epson TM-L90 was not detected." } }));

  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: /Connect your printer/i })).toBeVisible();
  const usbOption = page.getByRole("button", { name: /Epson TM-L90/i });
  await expect(usbOption).toContainText("not detected");
  await expect(page.getByRole("button", { name: /Virtual printer/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Finish setup/i })).toBeEnabled();
  await page.getByRole("button", { name: /Finish setup/i }).click();
  await expect(page.getByRole("button", { name: "Save as, saved" })).toBeVisible();
});

test("demo print never opens Epson setup", async ({ page }) => {
  let settings = { revision: 0, initialized: true, configured: false, printPolicy: "confirm", trustedTemplateIds: [], defaultLocation: "", defaultUnit: "fahrenheit", printerProfile: { completed: false, ownerFirstName: "", identityId: "owners-printer-western", useCaseIds: [] }, updatedAt: new Date().toISOString() };
  await page.route("**/api/v1/settings", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: settings });
    settings = { ...settings, ...route.request().postDataJSON(), revision: settings.revision + 1, initialized: true, updatedAt: new Date().toISOString() };
    return route.fulfill({ json: settings });
  });

  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Demo print", exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Demo print", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Printer setup" })).toHaveCount(0);
  const popup = await popupPromise;
  await expect(popup.locator("svg")).toBeVisible();
});

test("continues the original print after first-print setup", async ({ page }) => {
  let settings = { revision: 0, initialized: true, configured: false, printPolicy: "confirm", trustedTemplateIds: [], defaultLocation: "", defaultUnit: "fahrenheit", printerProfile: { completed: false, ownerFirstName: "", identityId: "owners-printer-western", useCaseIds: [] }, updatedAt: new Date().toISOString() };
  await page.route("**/api/v1/settings", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: settings });
    settings = { ...settings, ...route.request().postDataJSON(), revision: settings.revision + 1, initialized: true, updatedAt: new Date().toISOString() };
    return route.fulfill({ json: settings });
  });
  const submitted: string[] = [];
  const now = new Date().toISOString();
  await page.route("**/api/v1/print-requests", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { items: [] } });
    submitted.push(route.request().postData() ?? "");
    return route.fulfill({ json: { id: "first-print", status: "queued", checksum: "test", createdAt: now, updatedAt: now } });
  });
  await page.route("**/api/v1/print-requests/first-print", (route) => route.fulfill({ json: { id: "first-print", status: "succeeded", checksum: "test", createdAt: now, updatedAt: now } }));

  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Save as, saved" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print destination, Demo print" })).toBeVisible();
  await page.getByRole("button", { name: /Print destination/ }).click();
  await page.getByRole("menuitemradio", { name: /Epson printer/ }).click();
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Printer setup" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Virtual printer/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Save and print/i })).toBeEnabled();
  await page.getByRole("button", { name: /58 mm/i }).click();
  await page.getByRole("button", { name: /Save and print/i }).click();
  await expect(page.getByRole("button", { name: "Printed" })).toBeVisible();
  expect(submitted).toHaveLength(1);
});

test("explores the demo when the bridge is unreachable", async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 502, json: { error: { code: "bad_gateway", message: "The local bridge could not be reached." } } }));

  await page.goto("/setup");
  await expect(page.getByRole("button", { name: /Explore without setup/i })).toBeVisible();
  await page.getByRole("button", { name: /Explore without setup/i }).click();
  await expect(page.getByRole("button", { name: "Select heading block" }).first()).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Edit heading" });
  await page.getByRole("button", { name: "Select heading block" }).first().click();
  await editor.fill("JUST LOOKING AROUND");
  await expect(editor).toHaveValue("JUST LOOKING AROUND");
});

test("keeps heading text fixed when inline editing begins", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Select heading block" }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The logo block draws first, so measure the heading's own line rather than the topmost one.
  const headingLine = page.locator(".receipt-svg text", { hasText: /^Morning brief$/ });
  await expect.poll(async () => headingLine.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(40);
  const headingTopBeforeSelection = await headingLine.evaluate((element) => element.getBoundingClientRect().top);
  await page.getByRole("button", { name: "Select heading block" }).first().click();
  const editorStyle = await page.getByRole("textbox", { name: "Edit heading" }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, textFill: style.webkitTextFillColor };
  });
  const headingTopAfterSelection = await headingLine.evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(headingTopAfterSelection - headingTopBeforeSelection)).toBeLessThanOrEqual(1);
  expect(editorStyle).toEqual({ background: "rgba(0, 0, 0, 0)", color: "rgba(0, 0, 0, 0)", textFill: "rgba(0, 0, 0, 0)" });
});

test("opens the focused template and settings overlays", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "New from template" }).click();
  const templates = page.getByRole("dialog", { name: "Templates" });
  await expect(templates).toBeVisible();
  await expect(templates.getByText("Start with a shape")).toHaveCount(0);
  await expect(templates.getByText(/Your mark, today/)).toHaveCount(0);
  const previews = templates.locator(".template-preview");
  await expect(previews).toHaveCount(2);
  const previewHeights = await previews.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
  expect(new Set(previewHeights).size).toBe(1);

  await templates.getByRole("button", { name: /Checklist/i }).click();
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("Packing list");
  const checklist = page.getByRole("button", { name: "Select checklist block" });
  const geometryBeforeSelection = await checklist.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  await checklist.click();
  await expect(checklist).toHaveClass(/selected/);
  expect(await checklist.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  })).toEqual(geometryBeforeSelection);
  await expect(page.getByText("Selected block", { exact: true })).toHaveCount(0);
  await page.getByRole("tablist", { name: "Inspector view" }).getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("radiogroup", { name: "Paper size" })).toBeVisible();
  await page.getByRole("button", { name: /Trusted templates/i }).click();
  await expect(page.getByText("Approved templates")).toBeVisible();
});

test("names a new blank distinctly from the starter receipt", async ({ page }) => {
  await page.goto("/app");
  const rail = page.getByRole("complementary", { name: "Drafts and print queue" });
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("Morning brief");
  await expect(rail.getByRole("button", { name: "Morning brief", exact: true })).toBeVisible();

  await rail.getByRole("button", { name: "New blank" }).click();
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("Untitled");
  await expect(rail.getByRole("button", { name: "Untitled", exact: true })).toBeVisible();
  await expect(rail.getByRole("button", { name: "Morning brief", exact: true })).toBeVisible();

  await rail.getByRole("button", { name: "New blank" }).click();
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("Untitled 2");
  await expect(rail.getByRole("button", { name: "Untitled 2", exact: true })).toBeVisible();
});

test("uses a full-width three-part inspector for library, block format, and settings", async ({ page }) => {
  await page.goto("/app");
  const inspector = page.locator(".inspector");
  const tabs = page.getByRole("tablist", { name: "Inspector view" });
  await expect(tabs.getByRole("tab")).toHaveText(["Library", "Format", "Settings"]);
  const [inspectorWidth, tabsWidth] = await Promise.all([
    inspector.evaluate((element) => element.getBoundingClientRect().width),
    tabs.evaluate((element) => element.getBoundingClientRect().width),
  ]);
  expect(Math.abs(tabsWidth - (inspectorWidth - 20))).toBeLessThanOrEqual(1);

  await tabs.getByRole("tab", { name: "Settings" }).click();
  const narrowPaper = page.getByRole("radio", { name: "58 mm" });
  await narrowPaper.click();
  await expect(narrowPaper).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".receipt-svg svg")).toHaveAttribute("viewBox", /^0 0 420 /);
  await page.getByRole("button", { name: /Allow without asking/ }).click();
  await expect(page.getByRole("button", { name: /Allow without asking/ })).toHaveClass(/selected/);

  const separatorInsets = await inspector.locator(".inspector-section").first().evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return { left: style.left, right: style.right };
  });
  expect(separatorInsets).toEqual({ left: "14px", right: "14px" });

  await page.getByRole("button", { name: "Select heading block" }).first().click();
  await expect(tabs.getByRole("tab", { name: "Format" })).toHaveAttribute("aria-selected", "true");
});

test("empty Format names the receipt instead of showing the sign gallery", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  const inspector = page.locator(".inspector");
  await expect(inspector.getByRole("heading", { name: "Receipt", exact: true })).toBeVisible();
  await expect(inspector.getByText("Name your receipt")).toBeVisible();
  await expect(inspector.getByRole("textbox", { name: "Receipt title" })).toHaveValue("Morning brief");
  await expect(inspector.getByText("Click a block on the receipt to edit it.")).toBeVisible();
  await expect(inspector.getByRole("radiogroup", { name: "Printer wordmark" })).toHaveCount(0);

  await page.getByRole("button", { name: "Select logo block" }).click();
  await expect(inspector.getByRole("heading", { name: "Logo" })).toBeVisible();
  await expect(inspector.getByRole("radiogroup", { name: "Sign size" })).toBeVisible();
  await expect(inspector.getByRole("radiogroup", { name: "Printer wordmark" })).toBeVisible();

  await page.locator(".canvas-stage").click({ position: { x: 8, y: 8 } });
  await expect(inspector.getByText("Name your receipt")).toBeVisible();
  await expect(inspector.getByRole("radiogroup", { name: "Printer wordmark" })).toHaveCount(0);
});

test("uses one physical paper surface without animating the preview on print", async ({ page }) => {
  const now = new Date().toISOString();
  await page.route("**/api/v1/print-requests", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: { id: "visual-print", status: "queued", checksum: "test", createdAt: now, updatedAt: now } });
  });
  await page.route("**/api/v1/print-requests/visual-print", (route) => route.fulfill({ json: { id: "visual-print", status: "succeeded", checksum: "test", createdAt: now, updatedAt: now } }));

  await page.goto("/app");
  const paper = page.locator(".receipt-paper");
  await expect(paper).toHaveClass(/paper-surface/);
  await expect(page.locator(".receipt-tear")).toHaveCount(0);
  expect(await paper.evaluate((element) => getComputedStyle(element).clipPath.startsWith("polygon("))).toBe(true);

  await expect(page.getByRole("button", { name: "Print destination, Demo print" })).toBeVisible();
  await page.getByRole("button", { name: /Print destination/ }).click();
  const destinations = page.getByRole("menu", { name: "Print destination" }).getByRole("menuitemradio");
  await expect(destinations.nth(0)).toHaveAccessibleName(/Demo print/);
  await expect(destinations.nth(1)).toHaveAccessibleName(/Epson printer/);
  await page.getByRole("menuitemradio", { name: /Epson printer/ }).click();
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.locator(".receipt-shell")).not.toHaveClass(/is-feeding/);
  await expect(page.locator(".agent-cursor")).toHaveCount(0);
  await expect(page.locator(".agent-activity")).toHaveCount(0);
  await expect(page.locator(".agent-changed")).toHaveCount(0);
  await expect(page.getByText("The agent is printing the approved receipt")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Printing" })).toBeDisabled();
  await expect(page.locator(".print-pixel-grid")).toBeVisible();
  await expect(page.getByRole("button", { name: "Printed", exact: true })).toBeVisible();
  await expect(page.locator(".receipt-shell")).not.toHaveClass(/is-feeding/);
});

test("inserts between blocks, keeps shared undo history, and collapses secondary controls", async ({ page }) => {
  await page.goto("/app");
  const blockGroups = page.locator('.receipt-svg g[data-block-id]');
  const before = await blockGroups.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-block-id")));

  const insertionPoint = page.locator(".receipt-insertion-point").nth(1);
  const insertionBounds = await insertionPoint.boundingBox();
  expect(insertionBounds?.height).toBeGreaterThan(1);
  await insertionPoint.hover({ position: { x: 8, y: 2 } });
  await expect(page.getByRole("button", { name: "Insert block at position 2" })).toBeVisible();
  await page.getByRole("button", { name: "Insert block at position 2" }).click();
  await page.getByRole("menu", { name: "Add block" }).getByRole("menuitem", { name: "Text", exact: true }).click();
  const after = await blockGroups.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-block-id")));
  expect(after).toHaveLength(before.length + 1);
  expect(after[0]).toBe(before[0]);
  expect(after[2]).toBe(before[1]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(blockGroups).toHaveCount(before.length);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(blockGroups).toHaveCount(before.length + 1);

  await page.getByRole("button", { name: "Select heading block" }).first().click();
  await expect(page.getByRole("textbox", { name: "Block text" })).toBeHidden();
  await page.getByText("Text content", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Block text" })).toBeVisible();
  await page.getByRole("button", { name: "Select text block" }).last().click();
  await expect(page.locator(".inspector")).toBeVisible();

  for (let index = 0; index < 8; index += 1) {
    await page.getByRole("button", { name: "Add block", exact: true }).click();
    await page.getByRole("menu", { name: "Add block" }).getByRole("menuitem", { name: "Text", exact: true }).click();
  }
  const canvas = page.locator(".canvas-stage");
  expect(await canvas.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await canvas.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole("button", { name: "Add block", exact: true })).toBeVisible();
});

test("clears selection off-block and accepts a reorder from blank canvas space", async ({ page }) => {
  await page.goto("/app");
  const blocks = page.locator('.receipt-svg g[data-block-id]');
  const before = await blocks.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-block-id")));
  const heading = before[1]; // The logo block signs the top of the paper, so the heading is second.
  await page.getByRole("button", { name: "Select heading block" }).first().click();
  await expect(page.locator(".receipt-selection-frame")).toHaveCSS("border-top-style", "dashed");

  const canvas = page.locator(".canvas-stage");
  await canvas.click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".receipt-selection-frame, .receipt-block-hit.selected")).toHaveCount(0);
  await expect(page.getByText("This is a real receipt.", { exact: true }).last()).toBeVisible();

  await page.getByRole("button", { name: "Select heading block" }).first().click();
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error("Canvas bounds unavailable");
  await page.getByRole("button", { name: "Drag selected block" }).dragTo(canvas, { targetPosition: { x: 12, y: canvasBounds.height - 24 } });
  const after = await blocks.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-block-id")));
  expect(after.at(-1)).toBe(heading);
});

test("shows printer connection on the destination menu instead of a separate status chip", async ({ page }) => {
  await page.unroute("**/api/v1/capabilities");
  let connected = false;
  await page.route("**/api/v1/capabilities", (route) => route.fulfill({ json: { ...capabilities, connected, transport: "usb" } }));
  await page.goto("/app");

  const destination = page.getByRole("button", { name: /Print destination/ });
  await expect(destination).toHaveAccessibleName(/Demo print/);
  await expect(destination.locator(".status-dot")).toHaveClass(/online/);
  await destination.click();
  const destinations = page.getByRole("menu", { name: "Print destination" }).getByRole("menuitemradio");
  await expect(destinations.nth(0)).toHaveAccessibleName(/Demo print/);
  await expect(destinations.nth(1)).toHaveAccessibleName(/Epson printer/);
  const printerItem = page.getByRole("menuitemradio", { name: /Epson printer/ });
  await expect(printerItem.locator(".status-dot")).toHaveClass(/offline/);
  await expect(printerItem.getByText("Not connected")).toBeVisible();
  const demoItem = page.getByRole("menuitemradio", { name: /Demo print/ });
  await expect(demoItem.locator(".status-dot")).toHaveClass(/online/);

  connected = true;
  await destination.click();
  await destination.click();
  await expect(page.getByRole("menuitemradio", { name: /Epson printer/ }).locator(".status-dot")).toHaveClass(/online/);
  await expect(page.getByRole("menuitemradio", { name: /Epson printer/ }).getByText("Epson TM-L90")).toBeVisible();
  await page.getByRole("menuitemradio", { name: /Epson printer/ }).click();
  await expect(destination).toHaveAccessibleName(/Epson printer/);
  await expect(destination.locator(".status-dot")).toHaveClass(/online/);
});

test("does not treat dummy file output as a connected Epson", async ({ page }) => {
  await page.unroute("**/api/v1/capabilities");
  await page.route("**/api/v1/capabilities", (route) => route.fulfill({ json: { ...capabilities, connected: true, transport: "dummy" } }));
  await page.goto("/app");

  const destination = page.getByRole("button", { name: /Print destination/ });
  await expect(destination).toHaveAccessibleName(/Demo print/);
  await expect(destination.locator(".status-dot")).toHaveClass(/online/);
  await destination.click();
  await expect(page.getByRole("menuitemradio", { name: /Epson printer/ }).locator(".status-dot")).toHaveClass(/offline/);
  await expect(page.getByRole("menuitemradio", { name: /Epson printer/ }).getByText("Not connected")).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /Demo print/ }).locator(".status-dot")).toHaveClass(/online/);
});

test("keeps drafts and block format when editor columns collapse", async ({ page }) => {
  const drafts = page.getByRole("complementary", { name: "Drafts and print queue" });
  const inspector = page.locator(".inspector");
  const formatSheet = page.getByRole("dialog", { name: "Logo" });

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/app");
  await expect(drafts).toBeVisible();
  await expect(page.getByRole("button", { name: "Drafts" })).toBeHidden();
  await expect(inspector).toBeVisible();
  await expect(page.locator(".inspector-sheet-overlay")).toHaveCount(0);

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(drafts).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Drafts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Templates" })).toBeVisible();
  await page.getByRole("button", { name: "Select logo block" }).click();
  await expect(inspector.getByRole("radiogroup", { name: "Sign size" })).toBeVisible();
  await expect(inspector.getByRole("radiogroup", { name: "Printer wordmark" })).toBeVisible();

  const previousTitle = await page.getByRole("textbox", { name: "Receipt title" }).first().inputValue();
  await page.getByRole("button", { name: "Drafts" }).click();
  await expect(drafts).toBeVisible();
  await expect(drafts).toHaveCSS("position", "fixed");
  await drafts.getByRole("button", { name: "New blank" }).click();
  await expect(drafts).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).not.toHaveValue(previousTitle);
  await page.getByRole("button", { name: "Drafts" }).click();
  await drafts.getByRole("button", { name: previousTitle, exact: true }).click();
  await expect(drafts).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue(previousTitle);

  await page.setViewportSize({ width: 420, height: 800 });
  await expect(inspector).toBeHidden();
  await expect(formatSheet).toBeVisible();
  await page.getByRole("button", { name: "Close format" }).click();
  await expect(formatSheet).toHaveCount(0);
  await page.getByRole("button", { name: "Drafts" }).click();
  await expect(drafts).toBeVisible();
  const sheetBox = await drafts.boundingBox();
  expect(sheetBox).toBeTruthy();
  expect(sheetBox!.width).toBeGreaterThan(400);
  expect(sheetBox!.y).toBeGreaterThan(150);
  await page.keyboard.press("Escape");
  await expect(drafts).toHaveCount(0);

  await page.getByRole("button", { name: "Select logo block" }).click();
  await expect(formatSheet).toBeVisible();
  await expect(formatSheet.getByRole("radiogroup", { name: "Sign size" })).toBeVisible();
  await expect(formatSheet.getByRole("radiogroup", { name: "Printer wordmark" })).toBeVisible();
  await expect(formatSheet.getByRole("textbox", { name: "Logo name" })).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Mobile text formatting" })).toHaveCount(0);
  await formatSheet.getByRole("button", { name: "Close format" }).click();
  await expect(formatSheet).toHaveCount(0);

  await page.getByRole("button", { name: "Select heading block" }).first().click();
  await expect(formatSheet).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Mobile text formatting" })).toBeVisible();
});

test("keeps a long receipt scrollable on a narrow editor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 620 });
  await page.goto("/app");
  await page.getByRole("button", { name: "Select heading block" }).first().click();
  const mobileFormatter = page.getByRole("toolbar", { name: "Mobile text formatting" });
  await expect(mobileFormatter).toBeVisible();
  await expect(page.locator(".inspector")).toBeHidden();
  await mobileFormatter.getByRole("button", { name: "Italic" }).click();
  await expect(page.locator('.receipt-svg text[font-style="italic"]')).not.toHaveCount(0);
  for (let index = 0; index < 8; index += 1) {
    await page.getByRole("button", { name: "Add block", exact: true }).click();
    await page.getByRole("menu", { name: "Add block" }).getByRole("menuitem", { name: "Text", exact: true }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.locator(".canvas-stage").hover();
  await page.mouse.wheel(0, 500);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 520 }] });
  for (const y of [470, 410, 350, 290, 230, 170]) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y }] });
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Add block", exact: true })).toBeVisible();
  await expect(mobileFormatter).toBeVisible();
});

type ShimWindow = Window & { __webmcpShim: { tools: Map<string, unknown>; call(name: string, input?: unknown): Promise<{ content: Array<{ text: string }>; structuredContent: Record<string, unknown> }> }; __printPromise?: Promise<unknown> };

/** The production build only installs the local WebMCP host when it is asked for. */
const shimUrl = (path: string) => `${path}?webmcp=shim`;
const shimReady = (page: import("@playwright/test").Page) =>
  expect.poll(() => page.evaluate(() => (window as unknown as ShimWindow).__webmcpShim?.tools.size ?? 0)).toBe(11);

test("turns a described situation into a designed receipt", async ({ page }) => {
  await page.goto(shimUrl("/app"));
  await shimReady(page);

  // The app supplies the taste: the agent asks which blocks belong on a trip receipt.
  const recipes = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("list_receipt_recipes", { situation: "I'm flying to Lisbon on an international flight Thursday" }));
  expect(recipes.structuredContent.matched).toContain("travel_prep");

  await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("draft_receipt", {
    title: "Lisbon · four days",
    blocks: [
      { type: "heading", text: "Lisbon, four days", size: "display" },
      { type: "countdown", event: "Wheels up", date: "Thursday 8:20 AM", days: 3, milestones: ["Booked", "Packed", "Go"] },
      { type: "facts", rows: [{ label: "Flight", value: "TP 204", emphasis: true }, { label: "Seat", value: "14A" }] },
      { type: "groups", title: "Packing", note: "Carry-on only", groups: [
        { name: "Carry-on", items: ["Passport", "EU adapter"] },
        { name: "Before the door", items: ["Bins out"] },
      ] },
    ],
  }));

  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("Lisbon · four days");
  await expect(page.locator(".receipt-svg")).toContainText("DAYS TO GO");
  await expect(page.locator(".receipt-svg")).toContainText("TP 204");
  await expect(page.locator(".receipt-svg")).toContainText("Passport");
  await expect(page.locator(".agent-cursor")).toBeVisible();
  await expect(page.locator(".agent-cursor").getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.locator(".agent-cursor-caption")).toHaveText("Drafted Lisbon · four days");

  // The agent can read back what will physically print.
  const preview = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("preview_receipt", {}));
  expect(preview.content[0].text).toContain("[ ] Passport");
  expect(preview.structuredContent.paperLengthMm).toBeGreaterThan(0);

  // One item changes without rewriting the block the human may be editing.
  await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("edit_receipt", { operations: [{ op: "checkItem", at: 5, item: "passport" }] }));
  const outline = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("get_receipt", {}));
  expect(outline.content[0].text).toContain("1/3");

  // A dry run reports the change without committing it.
  const before = outline.structuredContent.revision;
  const dry = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("edit_receipt", { dryRun: true, operations: [{ op: "remove", at: 1 }] }));
  expect(dry.structuredContent.status).toBe("dry_run");
  const after = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("get_receipt", {}));
  expect(after.structuredContent.revision).toBe(before);

  // Undo steps back exactly one change: the item that was just checked.
  const undone = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("undo_agent_edit", {}));
  expect(undone.content[0].text).toContain("0/3");
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("Lisbon · four days");
});

test("lists the block vocabulary an agent can draw on", async ({ page }) => {
  await page.goto(shimUrl("/app"));
  await shimReady(page);
  const blocks = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("list_receipt_blocks", {}));
  const types = (blocks.structuredContent.blocks as Array<{ type: string }>).map((entry) => entry.type);
  expect(types).toEqual(expect.arrayContaining(["groups", "countdown", "weather", "facts", "form"]));
  expect(blocks.content[0].text).toContain("(live)");
});

test("registers its tools away from the editor too", async ({ page }) => {
  await page.goto(shimUrl("/"));
  await shimReady(page);
  const status = await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("get_app_status", {}));
  expect(status.content[0].text).toContain("Editor:");
  await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("open_receipt_editor", {}));
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toBeVisible();
});

test("binds agent print approval to one visible revision", async ({ page }) => {
  const now = new Date().toISOString();
  await page.route("**/api/v1/print-requests", (route) => route.fulfill({ json: { id: "agent-print", status: "queued", checksum: "test", createdAt: now, updatedAt: now } }));
  await page.route("**/api/v1/print-requests/agent-print", (route) => route.fulfill({ json: { id: "agent-print", status: "succeeded", checksum: "test", createdAt: now, updatedAt: now } }));
  await page.goto(shimUrl("/app"));
  await shimReady(page);

  await page.evaluate(async () => (window as unknown as ShimWindow).__webmcpShim.call("draft_receipt", {
    title: "Take recycling out",
    blocks: [
      { type: "heading", text: "Take recycling out", size: "display" },
      { type: "text", text: "Put the blue bin by the door tonight.", size: "large" },
      { type: "list", items: ["Flatten boxes", "Take out the bin"] },
    ],
  }));
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue("Take recycling out");
  await expect(page.locator(".receipt-svg")).toContainText("Put the blue bin by the door tonight.");

  await page.evaluate(async () => {
    const target = window as unknown as ShimWindow;
    const state = await target.__webmcpShim.call("get_receipt", {});
    target.__printPromise = target.__webmcpShim.call("request_receipt_print", { expectedRevision: state.structuredContent.revision, reason: "Print the reminder by the door." });
  });
  const approval = page.getByRole("dialog", { name: /agent wants to print/i });
  await expect(approval).toBeVisible();
  await expect(approval.getByText(/Revision \d+/)).toBeVisible();

  // Any human edit cancels the approval, so an approved draft cannot drift.
  await page.getByRole("textbox", { name: "Receipt title" }).first().fill("Changed while reviewing");
  await expect(approval).toHaveCount(0);
  const stale = await page.evaluate(() => (window as unknown as ShimWindow).__printPromise) as { structuredContent: Record<string, unknown> };
  expect(stale.structuredContent).toMatchObject({ status: "stale" });

  await page.evaluate(async () => {
    const target = window as unknown as ShimWindow;
    const state = await target.__webmcpShim.call("get_receipt", {});
    target.__printPromise = target.__webmcpShim.call("request_receipt_print", { expectedRevision: state.structuredContent.revision, reason: "The revised reminder is ready." });
  });
  await page.getByRole("button", { name: "Approve and print" }).click();
  const printed = await page.evaluate(() => (window as unknown as ShimWindow).__printPromise) as { structuredContent: Record<string, unknown> };
  expect(printed.structuredContent).toMatchObject({ status: "succeeded", jobId: "agent-print" });
});

test("favorites a library block and keeps it close in the inspector and Add menu", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("tab", { name: "Library" }).click();
  await expect(page.getByText("Favorites")).toBeVisible();
  await page.getByRole("button", { name: "Browse library" }).click();

  const library = page.getByRole("dialog", { name: "Block Library" });
  await expect(library).toBeVisible();
  const firstCard = library.locator(".library-card").first();
  const thumbnailGeometry = await firstCard.evaluate((card) => {
    const preview = card.querySelector<HTMLElement>(".library-card-preview");
    const paper = card.querySelector<HTMLElement>(".library-card-preview .library-paper");
    const title = card.querySelector<HTMLElement>(".library-card-copy");
    if (!preview || !paper || !title) return { share: 0, cropped: false, titleBelow: false };
    const previewBox = preview.getBoundingClientRect();
    return {
      share: previewBox.height / card.getBoundingClientRect().height,
      cropped: paper.getBoundingClientRect().bottom > previewBox.bottom,
      titleBelow: title.getBoundingClientRect().top >= previewBox.bottom,
    };
  });
  expect(thumbnailGeometry.share).toBeGreaterThan(0.7);
  expect(thumbnailGeometry.cropped).toBe(true);
  expect(thumbnailGeometry.titleBelow).toBe(true);
  await expect(library.locator(".library-card-copy small, .library-badge")).toHaveCount(0);
  await library.getByRole("button", { name: "Add Agenda to favorites" }).click();
  await expect(library.getByRole("button", { name: "Remove Agenda from favorites" })).toBeVisible();
  await library.getByRole("button", { name: "Close Block Library" }).click();

  await expect(page.getByText("Agenda", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Add Agenda" }).click();
  await expect(page.getByRole("button", { name: "Select agenda block" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Format" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Agenda added", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Agenda date")).toBeVisible();

  await page.getByRole("button", { name: "Add block", exact: true }).click();
  const addMenu = page.getByRole("menu", { name: "Add block" });
  await expect(addMenu.getByRole("menuitem", { name: "Heading" })).toBeVisible();
  await expect(addMenu.getByRole("menuitem", { name: "Agenda" })).toHaveCount(0);
  await expect(addMenu.getByRole("menuitem", { name: "Browse all blocks…" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Library" })).toHaveAttribute("aria-selected", "true");
});

test("inserts a configured favorite without reopening the library", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("tab", { name: "Library" }).click();
  await page.getByRole("button", { name: "Browse library" }).click();
  const library = page.getByRole("dialog", { name: "Block Library" });
  await library.getByLabel("Search Block Library").fill("countdown");
  await library.getByRole("button", { name: "Add Countdown to favorites" }).click();
  await library.getByRole("button", { name: "Close Block Library" }).click();

  await page.getByRole("button", { name: "Add Countdown" }).click();
  await expect(page.getByRole("dialog", { name: "Block Library" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select countdown block" })).toHaveCount(2);
  await expect(page.getByRole("tab", { name: "Format" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Countdown added", { exact: true })).toBeVisible();
});

test("names the printer on paper without renaming the chrome", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Make it mine" }).first().click();
  await page.getByLabel("First name").fill("Maya");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Daily briefings/ }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("dialog", { name: "Name your printer" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Block Library" })).toHaveCount(0);
  await expect(page.getByLabel("OpenReceipt").first()).toBeVisible();
  await expect(page.getByText("For you", { exact: true })).toBeVisible();
  await expect(page.locator(".receipt-svg text", { hasText: "MAYA" }).first()).toBeVisible();
});

test("preserves a between-block insertion point through the Block Library", async ({ page }) => {
  await page.goto("/app");
  const groups = page.locator('.receipt-svg g[data-block-id]');
  const before = await groups.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-block-id")));

  await page.locator(".receipt-insertion-point").nth(1).hover();
  await page.getByRole("button", { name: "Insert block at position 2" }).click();
  await page.getByRole("menu", { name: "Add block" }).getByRole("menuitem", { name: "Browse all blocks…" }).click();
  const library = page.getByRole("dialog", { name: "Block Library" });
  await library.locator(".library-card").filter({ hasText: "Agenda" }).getByRole("button").first().click();
  await library.getByRole("button", { name: "Add block", exact: true }).click();

  const after = await groups.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-block-id")));
  expect(after).toHaveLength(before.length + 1);
  expect(after[0]).toBe(before[0]);
  expect(after[2]).toBe(before[1]);
  await expect(page.getByRole("dialog", { name: "Block Library" })).toHaveCount(0);
});

test("configures weather once, saves its snapshot, and refreshes it manually", async ({ page }) => {
  let forecastRequests = 0;
  await page.route("https://geocoding-api.open-meteo.com/**", (route) => route.fulfill({ json: {
    results: [{ name: "Brooklyn", admin1: "New York", country: "United States", latitude: 40.6782, longitude: -73.9442, timezone: "America/New_York" }],
  } }));
  await page.route("https://api.open-meteo.com/v1/forecast**", (route) => {
    forecastRequests += 1;
    route.fulfill({ json: {
      current: { time: "2026-08-31T08:00", temperature_2m: 72, apparent_temperature: 72, weather_code: 1 },
      hourly: {
        time: ["2026-08-31T06:00", "2026-08-31T09:00", "2026-08-31T14:00", "2026-08-31T19:00"],
        temperature_2m: [68, 72, 80, 74], weather_code: [1, 1, 2, 1], precipitation_probability: [5, 5, 10, 5],
      },
      daily: {
        time: ["2026-08-31"], temperature_2m_max: [81], temperature_2m_min: [66], precipitation_probability_max: [10], uv_index_max: [6.1], sunset: ["2026-08-31T19:29"],
      },
    } });
  });

  await page.goto("/app");
  await page.getByRole("tab", { name: "Library" }).click();
  await page.getByRole("button", { name: "Browse library" }).click();
  const library = page.getByRole("dialog", { name: "Block Library" });
  await library.getByText("Daily weather", { exact: true }).first().click();
  await library.getByLabel("City or postal code").fill("Brooklyn");
  await library.getByLabel("Temperature").selectOption("celsius");
  await library.getByRole("button", { name: "Add block", exact: true }).click();

  await expect(page.getByRole("button", { name: "Select weather block" })).toBeVisible();
  await expect(page.getByText("Brooklyn, New York")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh data" })).toBeVisible();
  expect(forecastRequests).toBe(1);
  await page.getByRole("button", { name: "Refresh data" }).click();
  await expect.poll(() => forecastRequests).toBe(2);

  // The unit is editable after insert; switching it refetches rather than sitting disabled.
  await page.getByLabel("Temperature").selectOption("fahrenheit");
  await page.getByRole("button", { name: "Apply and fetch" }).click();
  await expect.poll(() => forecastRequests).toBe(3);
});

test("keeps blocks with no data source off real paper", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("tab", { name: "Library" }).click();
  await page.getByRole("button", { name: "Browse library" }).click();
  const library = page.getByRole("dialog", { name: "Block Library" });
  await library.locator(".library-card").filter({ hasText: "Delivery route" }).getByRole("button").first().click();
  await expect(library.getByRole("link", { name: "Review in playground" })).toBeVisible();
  await expect(library.getByRole("button", { name: /Delivery route.*favorites/ })).toHaveCount(0);
  await expect(library.getByRole("button", { name: "Add block", exact: true })).toHaveCount(0);
});

test("configures a block that needs a city before it can be added", async ({ page }) => {
  await page.route("https://geocoding-api.open-meteo.com/**", (route) => route.fulfill({ json: {
    results: [{ name: "Lisbon", admin1: "Lisbon District", country: "Portugal", latitude: 38.72, longitude: -9.14, timezone: "Europe/Lisbon" }],
  } }));
  await page.route("https://air-quality-api.open-meteo.com/**", (route) => route.fulfill({ json: {
    current: { us_aqi: 33, pm2_5: 5.3, uv_index: 0 },
  } }));

  await page.goto("/app");
  await page.getByRole("tab", { name: "Library" }).click();
  await page.getByRole("button", { name: "Browse library" }).click();
  const library = page.getByRole("dialog", { name: "Block Library" });
  await library.locator(".library-card").filter({ hasText: "Air quality" }).getByRole("button").first().click();

  // The form is required, so an empty city names what is missing rather than throwing on insert.
  const city = library.getByLabel("City or postal code");
  await expect(city).toBeVisible();
  await city.fill("");
  await expect(library.getByRole("button", { name: /is needed/ })).toBeDisabled();

  await city.fill("Lisbon");
  await library.getByRole("button", { name: "Add block", exact: true }).click();
  await expect(page.getByText("Air quality added", { exact: true })).toBeVisible();
  await expect(page.locator(".receipt-svg")).toContainText("AIR QUALITY · LISBON");
});

test("moves a live block to another place and keeps the old data when the fetch fails", async ({ page }) => {
  await page.route("https://geocoding-api.open-meteo.com/**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("name") ?? "";
    if (query.toLowerCase().includes("nowhere")) return route.fulfill({ json: {} });
    return route.fulfill({ json: { results: [{ name: "Lisbon", admin1: "Lisbon District", country: "Portugal", latitude: 38.72, longitude: -9.14, timezone: "Europe/Lisbon" }] } });
  });
  await page.route("https://air-quality-api.open-meteo.com/**", (route) => route.fulfill({ json: {
    current: { us_aqi: 33, pm2_5: 5.3, uv_index: 0 },
  } }));

  await page.goto("/app");
  await page.getByRole("tab", { name: "Library" }).click();
  await page.getByRole("button", { name: "Browse library" }).click();
  const library = page.getByRole("dialog", { name: "Block Library" });
  await library.locator(".library-card").filter({ hasText: "Air quality" }).getByRole("button").first().click();
  await library.getByLabel("City or postal code").fill("Lisbon");
  await library.getByRole("button", { name: "Add block", exact: true }).click();
  await expect(page.locator(".receipt-svg")).toContainText("AIR QUALITY · LISBON");

  // A place that cannot be found must change nothing at all.
  await page.getByLabel("City or postal code").fill("Nowhereville");
  await page.getByRole("button", { name: "Apply and fetch" }).click();
  await expect(page.locator(".inspector-inline-error")).toContainText("No location found");
  await expect(page.locator(".receipt-svg")).toContainText("AIR QUALITY · LISBON");
});

test("lets an agent edit one line of a block without rewriting it", async ({ page }) => {
  await page.goto("/app?webmcp=shim");
  await page.getByRole("tab", { name: "Library" }).click();
  await page.getByRole("button", { name: "Browse library" }).click();
  const library = page.getByRole("dialog", { name: "Block Library" });
  await library.locator(".library-card").filter({ hasText: "Meeting notes" }).getByRole("button").first().click();
  await library.getByRole("button", { name: "Add block", exact: true }).click();
  await expect(page.getByLabel("Meeting topic")).toBeVisible();

  const position = await page.evaluate(async () => {
    const state = await (window as unknown as ShimWindow).__webmcpShim.call("get_receipt", {});
    return state.content[0].text.split("\n").findIndex((line) => /^\s*\d+\s+meeting/.test(line));
  });

  await page.evaluate(async (at) => (window as unknown as ShimWindow).__webmcpShim.call("edit_receipt", { operations: [
    { op: "addItem", at, group: "actions", text: "Book the airport train", fields: { owner: "Pete", due: "Wed" } },
  ] }), position);

  // The agent's line lands in the right section, with its named attributes.
  await expect(page.getByLabel("Action 1", { exact: true })).toHaveValue("Book the airport train");
  await expect(page.getByLabel("Owner of action 1")).toHaveValue("Pete");
  await expect(page.locator(".receipt-svg")).toContainText("Book the airport train");
});

test("reviews printable blocks, widths, local data, and the catalog", async ({ page }) => {
  await page.route(/api\.open-meteo|air-quality-api\.open-meteo|marine-api\.open-meteo|thesportsdb|frankfurter|hacker-news-firebasedatabase|earthquake\.usgs/, (route) => route.abort());
  await page.route("https://geocoding-api.open-meteo.com/**", (route) => route.fulfill({
    json: {
      results: [{ name: "Brooklyn", admin1: "New York", country: "United States", latitude: 40.6782, longitude: -73.9442, timezone: "America/New_York" }],
    },
  }));

  await page.goto("/blocks");
  await expect(page.getByRole("heading", { name: "Blocks are the fun part." })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Focus .* preview$/ })).toHaveCount(21);
  await expect(page.locator(".prototype-card .paper-surface")).toHaveCount(21);
  // The three with no data source are shown, but under their own heading.
  await expect(page.getByRole("heading", { name: "Design studies" })).toBeVisible();

  await page.getByRole("button", { name: "58 mm", exact: true }).click();
  await expect(page.getByText("420 dots").first()).toBeVisible();

  await page.getByLabel("Local data").fill("Brooklyn");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Brooklyn, New York, United States")).toBeVisible();

  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("button", { name: /More blocks/ }).click();
  const catalog = page.getByRole("dialog", { name: "More blocks" });
  await expect(catalog).toBeVisible();
  await catalog.getByLabel("Search blocks").fill("weather");
  await expect(catalog.getByRole("button", { name: /Daily weather/ })).toBeVisible();
  await expect(catalog.getByRole("button", { name: /Game board/ })).toHaveCount(0);
  await catalog.getByRole("button", { name: /Daily weather/ }).click();
  await expect(page.getByRole("dialog", { name: "Daily weather" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Daily weather" })).toHaveCount(0);
});

test("compares all thermal chart primitives at both paper widths", async ({ page }) => {
  await page.goto("/blocks/charts");
  await expect(page.getByRole("heading", { name: /Charts made for paper/i })).toBeVisible();
  await expect(page.locator("[data-chart-study]")).toHaveCount(10);
  await expect(page.locator('[data-chart-study][width="576"]')).toHaveCount(5);
  await expect(page.locator('[data-chart-study][width="420"]')).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Labeled dot matrix" })).toBeVisible();
  await page.getByRole("link", { name: /Back to blocks/i }).click();
  await expect(page.getByRole("heading", { name: /\d+ printable pieces/ })).toBeVisible();
});
