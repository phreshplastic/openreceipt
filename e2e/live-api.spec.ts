import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

const liveBaseUrl = "http://127.0.0.1:8732";
test.describe.configure({ mode: "serial" });

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const name = Buffer.from(type, "ascii");
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function monochromePng(width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([1, 0, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(Math.ceil(width / 8), 0xff)]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(pixels)), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

test("shares HTTP edits and browser-approved dummy printing through the live local API", async ({ page, playwright }) => {
  await page.goto(`${liveBaseUrl}/app`);
  await expect(page.getByRole("button", { name: "Save as, saved" })).toBeVisible();

  const headless = await playwright.request.newContext({ baseURL: liveBaseUrl });
  const session = await headless.post("/api/v1/session");
  const { csrfToken } = await session.json() as { csrfToken: string };
  await expect.poll(async () => (await headless.get("/api/v1/receipt")).status()).toBe(200);
  const current = await (await headless.get("/api/v1/receipt")).json() as { revision: number; document: Record<string, unknown> };
  const title = "Shared through the canonical API";
  const updatedDocument = { ...current.document, title };
  const updated = await headless.put("/api/v1/receipt", {
    headers: { "X-CSRF-Token": csrfToken },
    data: {
      mutationId: crypto.randomUUID(), expectedRevision: current.revision, proposedRevision: current.revision + 1,
      document: updatedDocument, actor: { kind: "api", label: "Headless acceptance client" }, summary: "Headless client changed the title",
    },
  });
  expect(updated.ok(), await updated.text()).toBe(true);
  await expect(page.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue(title);
  const canonical = await headless.post("/api/v1/render", { headers: { "X-CSRF-Token": csrfToken }, data: { document: updatedDocument } });
  expect(canonical.ok()).toBe(true);
  const pixels = (await canonical.json() as { previewPng: string }).previewPng;
  await expect(page.getByRole("img", { name: "Receipt print preview" })).toHaveAttribute("src", `data:image/png;base64,${pixels}`);
  const before = (await (await headless.get("/api/v1/receipts")).json() as { items: unknown[] }).items.length;
  const fresh = await page.context().browser()!.newContext();
  const secondBrowser = await fresh.newPage();
  await secondBrowser.goto(`${liveBaseUrl}/app`);
  await expect(secondBrowser.getByRole("textbox", { name: "Receipt title" }).first()).toHaveValue(title);
  await expect(secondBrowser.getByRole("img", { name: "Receipt print preview" })).toBeVisible();
  expect((await (await headless.get("/api/v1/receipts")).json() as { items: unknown[] }).items).toHaveLength(before);
  await fresh.close();

  const artifact = monochromePng(576, 80);
  const jobId = crypto.randomUUID();
  const printRequest = await headless.post("/api/v1/print-requests", {
    headers: { "X-CSRF-Token": csrfToken },
    multipart: {
      metadata: JSON.stringify({
        id: jobId, mutationId: crypto.randomUUID(), checksum: createHash("sha256").update(artifact).digest("hex"),
        rendererVersion: "live-e2e", expectedRevision: current.revision + 1,
        requester: { kind: "api", label: "Headless acceptance client" }, reason: "Verify browser approval and dummy output",
        width: 576, height: 80, feedLines: 4, cutMode: "full",
      }),
      artifact: { name: "receipt.png", mimeType: "image/png", buffer: artifact },
    },
  });
  expect(printRequest.status()).toBe(201);
  expect((await printRequest.json() as { status: string }).status).toBe("awaiting_approval");

  const approval = page.getByRole("dialog", { name: new RegExp(title) });
  await expect(approval).toBeVisible();
  await approval.getByRole("button", { name: "Approve and print" }).click();
  await expect(page.getByRole("button", { name: "Printed" })).toBeVisible();
  const completed = await (await headless.get(`/api/v1/print-requests/${jobId}`)).json() as { status: string };
  expect(completed.status).toBe("succeeded");
  await headless.dispose();
});

test("deleting a template during its save removes the durable server copy", async ({ page, playwright }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let submitted!: () => void;
  const uploadStarted = new Promise<void>((resolve) => { submitted = resolve; });
  await page.route(`${liveBaseUrl}/api/v1/templates`, async (route) => {
    if (route.request().method() === "POST") {
      submitted();
      await pending;
    }
    await route.continue();
  });
  const shelfReady = page.waitForResponse((response) => response.url().endsWith("/api/v1/templates") && response.request().method() === "GET");
  await page.goto(`${liveBaseUrl}/app`);
  await shelfReady;
  const title = await page.getByRole("textbox", { name: "Receipt title" }).first().inputValue();
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/v1/templates") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save as, saved" }).click();
  await page.getByRole("menuitem", { name: "Save as template" }).click();
  await uploadStarted;
  await page.getByRole("button", { name: "New from template", exact: true }).click();
  const removed = page.waitForResponse((response) => response.url().includes("/api/v1/templates/") && response.request().method() === "DELETE");
  await page.getByRole("button", { name: `Delete template ${title}`, exact: true }).click();
  release();
  const { id } = await (await saved).json() as { id: string };
  expect((await removed).request().url()).toBe(`${liveBaseUrl}/api/v1/templates/${encodeURIComponent(id)}`);
  const api = await playwright.request.newContext({ baseURL: liveBaseUrl });
  await api.post("/api/v1/session");
  expect((await (await api.get("/api/v1/templates")).json() as { items: { id: string }[] }).items.map((item) => item.id)).not.toContain(id);
  await api.dispose();
});
