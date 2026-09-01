import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

const liveBaseUrl = "http://127.0.0.1:8732";

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
  await expect(page.getByText("Saved to local API", { exact: true })).toBeVisible();

  const headless = await playwright.request.newContext({ baseURL: liveBaseUrl });
  const session = await headless.post("/api/v1/session");
  const { csrfToken } = await session.json() as { csrfToken: string };
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
  expect(updated.ok()).toBe(true);
  await expect(page.getByRole("textbox", { name: "Receipt title" })).toHaveValue(title);

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
  await expect(page.getByText("Printed", { exact: true })).toBeVisible();
  const completed = await (await headless.get(`/api/v1/print-requests/${jobId}`)).json() as { status: string };
  expect(completed.status).toBe("succeeded");
  await headless.dispose();
});
