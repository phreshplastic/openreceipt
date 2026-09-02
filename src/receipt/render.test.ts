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
    // Base64 font data is arbitrary letters and can spell "NaN" by chance, so the scan
    // for bad coordinates looks at the drawing, not the payload riding with it.
    expect(first.svg.replace(/<defs><style>[\s\S]*?<\/style><\/defs>/g, "")).not.toMatch(/NaN|undefined/);
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

  it("keeps trailing leading outside text-block selection geometry", () => {
    const document = createDefaultDocument();
    const heading = createBlock("heading");
    const text = createBlock("text");
    if (heading.type !== "heading" || text.type !== "text") throw new Error("Expected heading and text blocks");
    heading.text = "Display heading";
    heading.level = "display";
    text.text = "Body copy on the paper.";
    document.blocks = [heading, text];
    const rendered = renderReceiptSvg(document);
    const headingBox = rendered.blocks.find((block) => block.type === "heading")!;
    const textBox = rendered.blocks.find((block) => block.type === "text")!;

    expect(headingBox.height).toBe(36);
    expect(textBox.y - (headingBox.y + headingBox.height)).toBe(18);
    expect(textBox.height).toBe(20);
  });

  it("renders explicit text emphasis without changing the document font", () => {
    const document = createDefaultDocument();
    const text = createBlock("text");
    if (text.type !== "text") throw new Error("Expected a text block");
    text.text = "Styled on paper";
    text.weight = "bold";
    text.italic = true;
    text.underline = true;
    document.blocks = [text];

    const rendered = renderReceiptSvg(document);
    expect(rendered.svg).toContain('font-weight="720"');
    expect(rendered.svg).toContain('font-style="italic"');
    expect(rendered.svg).toContain('text-decoration="underline"');
  });
});
