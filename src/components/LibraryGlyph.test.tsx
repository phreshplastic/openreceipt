import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { blockCatalog } from "../blocks/catalog";
import { LibraryGlyph } from "./LibraryGlyph";

describe("library glyphs", () => {
  it("renders a representative icon for every catalog block", () => {
    for (const block of blockCatalog) {
      const { container, unmount } = render(<LibraryGlyph id={block.id} />);
      expect(container.querySelector(".library-glyph svg")).not.toBeNull();
      unmount();
    }
  });
});
