// @vitest-environment node
import { inflateSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { renderCanonical } from "./render";
import { createDefaultDocument } from "../src/receipt/templates";

describe("canonical printer artifact", () => {
  it("renders bold and italic as different pixels, and keeps a smooth screen preview", () => {
    const document = createDefaultDocument();
    const block = { id: crypto.randomUUID(), type: "text" as const, text: "A legible reminder for the day ahead.", size: "body" as const, weight: "regular" as const, italic: false, underline: false, align: "left" as const };
    document.blocks = [block];
    const normal = renderCanonical(document);
    const bold = renderCanonical({ ...document, blocks: [{ ...block, weight: "bold" }] });
    const italic = renderCanonical({ ...document, blocks: [{ ...block, italic: true }] });
    expect(bold.checksum).not.toBe(normal.checksum);
    expect(italic.checksum).not.toBe(normal.checksum);
    expect(normal.previewPng === normal.png).toBe(false);
    expect(Buffer.from(normal.previewPng, "base64").readUInt32BE(16)).toBe(normal.width * 2);
  });
  it.each([576, 420] as const)("encodes a deterministic monochrome %s-dot PNG with visible ink", (width) => {
    const document = createDefaultDocument();
    document.page = { printableWidthDots: width, paperWidthMm: width === 576 ? 80 : 58, paddingDots: width === 576 ? 28 : 22 };
    const first = renderCanonical(document);
    expect(renderCanonical(document).png).toEqual(first.png);
    const bytes = Buffer.from(first.png, "base64");
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(first.height);
    const compressed: Buffer[] = [];
    for (let offset = 8; offset < bytes.length;) {
      const length = bytes.readUInt32BE(offset);
      if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const rows = inflateSync(Buffer.concat(compressed));
    let black = 0;
    let invalid = 0;
    for (let y = 0; y < first.height; y++) for (let x = 0; x < width; x++) {
      const pixel = rows.subarray(y * (width * 4 + 1) + 1 + x * 4, y * (width * 4 + 1) + 5 + x * 4);
      if (![0, 255].includes(pixel[0]) || pixel[1] !== pixel[0] || pixel[2] !== pixel[0] || pixel[3] !== 255) invalid++;
      if (pixel[0] === 0) black++;
    }
    expect(invalid).toBe(0);
    expect(black).toBeGreaterThan(2000);
  });
});
