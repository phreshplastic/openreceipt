import { describe, expect, it } from "vitest";
import { createBlock } from "./model";
import { renderReceiptSvg, wrapText } from "./render";
import { createDefaultDocument } from "./templates";

describe("receipt renderer", () => {
  it.each([
    [80, 576, 28],
    [58, 420, 22],
  ] as const)("renders %s mm deterministically at %s dots", (paperWidthMm, printableWidthDots, paddingDots) => {
    const document = createDefaultDocument();
    document.page = { paperWidthMm, printableWidthDots, paddingDots };
    document.blocks.push(createBlock("checklist"), createBlock("keyValue"), createBlock("table"), createBlock("divider"));
    const first = renderReceiptSvg(document);
    const second = renderReceiptSvg(document);
    expect(first).toEqual(second);
    expect(first.width).toBe(printableWidthDots);
    expect(first.blocks).toHaveLength(document.blocks.length);
    expect(first.svg).not.toMatch(/NaN|undefined/);
  });

  it("wraps long words and explicit lines", () => {
    expect(wrapText("first\nsecond", 100, { size: 20, lineHeight: 24, weight: 400 })).toEqual(["first", "second"]);
    expect(wrapText("averylongunbrokenword", 35, { size: 20, lineHeight: 24, weight: 400 }).length).toBeGreaterThan(1);
  });

  it("returns interaction geometry inside the paper", () => {
    const rendered = renderReceiptSvg(createDefaultDocument());
    for (const block of rendered.blocks) {
      expect(block.x).toBeGreaterThanOrEqual(0);
      expect(block.y).toBeGreaterThanOrEqual(0);
      expect(block.x + block.width).toBeLessThanOrEqual(rendered.width);
      expect(block.y + block.height).toBeLessThanOrEqual(rendered.height);
    }
  });
});
