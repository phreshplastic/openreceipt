import { createHash } from "node:crypto";
import { Resvg } from "@resvg/resvg-js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bodyFontData, italicFontData, wordmarkFontData } from "../src/receipt/fonts";
import { signFontBytes } from "../src/blocks/wordmarks";
import { receiptDocumentSchema } from "../src/receipt/model";
import { renderReceiptSvg } from "../src/receipt/render";

let fontFiles: string[] | undefined;
function bundledFonts() {
  if (fontFiles) return fontFiles;
  const directory = mkdtempSync(join(tmpdir(), "openreceipt-fonts-"));
  fontFiles = [...bodyFontData, ...italicFontData, ...wordmarkFontData.map((font) => font.data)].map((data, index) => {
    const path = join(directory, `inter-${index}.ttf`);
    writeFileSync(path, Buffer.from(data.split(",")[1], "base64"));
    return path;
  });
  const sign = join(directory, "sign.ttf");
  writeFileSync(sign, signFontBytes());
  fontFiles.push(sign);
  return fontFiles;
}

export function renderSmoothSvg(svg: string, scale = 2) {
  return new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: bundledFonts(), defaultFontFamily: "Inter", sansSerifFamily: "Inter" },
    fitTo: { mode: "zoom", value: scale },
  }).render().asPng();
}

export function renderCanonical(document: unknown) {
  const rendered = renderReceiptSvg(receiptDocumentSchema.parse(document));
  if (rendered.height > 10_000) throw new Error("The receipt exceeds the 10,000-dot print limit. Split it into shorter receipts.");
  const options = {
    font: { loadSystemFonts: false, fontFiles: bundledFonts(), defaultFontFamily: "Inter", sansSerifFamily: "Inter" },
  };
  const raster = new Resvg(rendered.svg, options).render();
  const previewPng = renderSmoothSvg(rendered.svg).toString("base64");
  const pixels = raster.pixels;
  for (let i = 0; i < pixels.length; i += 4) {
    const value = pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722 < 172 ? 0 : 255;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
  // resvg's pixels are a copy. Encode the thresholded pixels rather than the original raster.
  const png = encodePng(pixels, rendered.width, rendered.height);
  return { ...rendered, previewPng, png: png.toString("base64"), checksum: createHash("sha256").update(png).digest("hex") };
}

import { deflateSync } from "node:zlib";
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  const prefix = Buffer.alloc(4); prefix.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([prefix, payload, crc]);
}
function encodePng(pixels: Uint8Array, width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rows.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
