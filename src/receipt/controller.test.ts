import { describe, expect, it } from "vitest";
import { applyReceiptOperations, createReceiptState, StaleReceiptRevisionError } from "./controller";
import { createBlock } from "./model";
import { createDefaultDocument, createFromTemplate } from "./templates";

describe("receipt controller", () => {
  it("applies a batch atomically and increments one revision", () => {
    const state = createReceiptState(createDefaultDocument());
    const block = createBlock("divider");
    const next = applyReceiptOperations(state, 0, [
      { type: "setTitle", title: "Morning" },
      { type: "add", block, index: 1 },
      { type: "move", id: block.id, toIndex: 0 },
    ]);
    expect(next.revision).toBe(1);
    expect(next.document.title).toBe("Morning");
    expect(next.document.blocks[0].id).toBe(block.id);
  });

  it("rejects stale edits without changing the input", () => {
    const state = createReceiptState(createDefaultDocument(), 3);
    expect(() => applyReceiptOperations(state, 2, [{ type: "setTitle", title: "Stale" }])).toThrow(StaleReceiptRevisionError);
    expect(state.document.title).toBe("Untitled receipt");
  });

  it("rejects removing the last block", () => {
    const { document } = createFromTemplate("blank");
    document.blocks = [document.blocks[0]];
    const state = createReceiptState(document);
    expect(() => applyReceiptOperations(state, 0, [{ type: "remove", id: document.blocks[0].id }])).toThrow();
  });

  it("clears trusted provenance after any document edit", () => {
    const state = createReceiptState(createDefaultDocument(), 0, { kind: "template", id: "blank", revision: 1 });
    const next = applyReceiptOperations(state, 0, [{ type: "setTitle", title: "Changed" }]);
    expect(next.source).toBeUndefined();
  });
});
