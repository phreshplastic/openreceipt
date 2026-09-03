import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../receipt/templates";
import { emptyDraftStore, saveTemplate } from "./drafts";
import { matchTemplate, summarizeTemplates } from "./shelf";

describe("template shelf", () => {
  it("lists built-ins before saved templates", () => {
    const store = saveTemplate(emptyDraftStore, { name: "Lisbon packing", document: createDefaultDocument() });
    expect(summarizeTemplates(store).map((template) => template.name)).toEqual([
      "Blank receipt",
      "Checklist",
      "Lisbon packing",
    ]);
  });

  it("resolves a saved template by name", () => {
    const document = createDefaultDocument();
    document.title = "Lisbon packing";
    const store = saveTemplate(emptyDraftStore, { name: "Lisbon packing", document });
    const resolved = matchTemplate(store, "lisbon");
    expect(resolved?.kind).toBe("user");
    expect(resolved?.document.title).toBe("Lisbon packing");
  });
});
