import { describe, expect, it } from "vitest";
import { samplePrototypeData } from "./fixtures";
import { renderPrototypeBlock } from "./render";
import type { PaperWidthDots, PrototypeBlockId } from "./types";

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
      expect(first.svg).not.toMatch(/NaN|undefined|rgb\(/i);
      expect([...first.svg.matchAll(/#[a-f\d]{3,6}/gi)].map((match) => match[0]).every((color) => ["#000", "#fff"].includes(color.toLowerCase()))).toBe(true);
    }
  });
});
