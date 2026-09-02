import { describe, expect, it } from "vitest";
import { receiptDocumentSchema } from "../receipt/model";
import { createDefaultDocument } from "../receipt/templates";
import { samplePrototypeData } from "./fixtures";
import { renderPrototypeBlock } from "./render";
import type { PaperWidthDots, PrototypeBlockId } from "./types";
import type { WordmarkSize } from "./wordmarks";

const withoutEmbeddedFont = (svg: string) => svg.replace(/<defs><style>[\s\S]*?<\/style><\/defs>/g, "");

describe("prototype block renderer", () => {
  const ids = Object.keys(samplePrototypeData) as PrototypeBlockId[];
  const widths: PaperWidthDots[] = [576, 420];

  it.each(widths)("renders all twelve blocks deterministically at %i dots", (width) => {
    for (const id of ids) {
      const first = renderPrototypeBlock(id, samplePrototypeData[id] as never, width);
      const second = renderPrototypeBlock(id, samplePrototypeData[id] as never, width);
      expect(first).toEqual(second);
      expect(first.width).toBe(width);
      expect(first.height).toBeGreaterThanOrEqual(120);
      expect(first.svg).toContain(`viewBox="0 0 ${width} ${first.height}"`);
      expect(first.svg).toContain(`data-prototype="${id}"`);
      // Base64 font data is arbitrary letters and can spell "NaN" by chance, so the
      // scan for bad coordinates looks at the drawing, not the payload riding with it.
      expect(withoutEmbeddedFont(first.svg)).not.toMatch(/NaN|undefined|rgb\(/i);
      expect([...first.svg.matchAll(/#[a-f\d]{3,6}/gi)].map((match) => match[0]).every((color) => ["#000", "#fff"].includes(color.toLowerCase()))).toBe(true);
    }
  });
});

describe("wordmark size", () => {
  const logo = samplePrototypeData.logo;

  it("still clears the 120-dot floor at the smallest size", () => {
    const rendered = renderPrototypeBlock("logo", { ...logo, size: "small" }, 576);
    expect(rendered.height).toBeGreaterThanOrEqual(120);
  });

  it.each(["owners-printer-western", "oval-badge"] as const)("renders small < medium < large for %s", (style) => {
    const heights = (["small", "medium", "large"] as WordmarkSize[]).map(
      (size) => renderPrototypeBlock("logo", { ...logo, style, size }, 576).height,
    );
    expect(heights[0]).toBeLessThan(heights[1]);
    expect(heights[1]).toBeLessThan(heights[2]);
  });

  it("defaults a stored logo block with no size key to medium (migration safety)", () => {
    const document = createDefaultDocument();
    const withoutSize = {
      ...document,
      blocks: document.blocks.map((block) =>
        block.type === "catalog" && block.kind === "logo"
          ? { ...block, data: { style: block.data.style, primary: block.data.primary } }
          : block,
      ),
    };
    const storedLogo = withoutSize.blocks.find((block) => block.type === "catalog" && block.kind === "logo");
    expect(storedLogo && "data" in storedLogo && (storedLogo.data as { size?: string }).size).toBeUndefined();

    const parsed = receiptDocumentSchema.parse(withoutSize);
    const parsedLogo = parsed.blocks.find((block) => block.type === "catalog" && block.kind === "logo");
    expect(parsedLogo?.type === "catalog" && parsedLogo.kind === "logo" && parsedLogo.data.size).toBe("medium");
  });
});
