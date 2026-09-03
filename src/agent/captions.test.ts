import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../receipt/templates";
import {
  agentFocusBlockIds,
  captionForAddedBlock,
  captionForDraft,
  captionForDraftProgress,
  captionForOperations,
  captionForPhase,
  captionForPrint,
  captionForRename,
  captionForTemplate,
  changedBlockIds,
  polishCaption,
} from "./captions";

describe("agent captions", () => {
  it("drops wrapping quotes and a trailing period", () => {
    expect(polishCaption("Drafted “Lisbon”.")).toBe("Drafted Lisbon");
    expect(polishCaption('The agent drafted "Lisbon".')).toBe("Drafted Lisbon");
  });

  it("names a draft without quoting the title", () => {
    expect(captionForDraft("Lisbon · four days")).toBe("Drafted Lisbon · four days");
    expect(captionForRename("Lisbon trip")).toBe("Named Lisbon trip");
    expect(captionForTemplate("Packing")).toBe("Saved Packing");
    expect(captionForTemplate("Packing", true)).toBe("Updated Packing");
    expect(captionForTemplate("Checklist", false, "load")).toBe("Loaded Checklist");
  });

  it("describes a weather add the way a person would say it", () => {
    expect(captionForAddedBlock({ type: "weather", city: "Lisbon" })).toBe("Added Lisbon weather");
    expect(captionForDraftProgress({ type: "weather", city: "Lisbon" })).toBe("Fetching Lisbon weather");
  });

  it("summarizes one edit operation, then folds extras", () => {
    expect(captionForOperations([{ op: "checkItem", item: "Passport" }])).toBe("Checked Passport");
    expect(captionForOperations([{ op: "setCopy", text: "Lisbon, four days" }])).toBe("Updated Lisbon, four days");
    expect(captionForOperations([{ op: "addItem", text: "EU adapter" }, { op: "checkItem", item: "Passport" }])).toBe("Added EU adapter and 1 more");
  });

  it("keeps working and print states short", () => {
    expect(captionForPhase("drafting")).toBe("Drafting a receipt");
    expect(captionForPhase("waitingForApproval")).toBe("Requesting a print");
    expect(captionForPrint("succeeded", "The receipt printed successfully.")).toBe("Printed");
    expect(captionForPrint("rejected")).toBe("Kept as a draft");
  });
});

describe("changed block ids", () => {
  it("skips the inherited sign when other blocks changed", () => {
    const before = createDefaultDocument();
    const after = {
      ...before,
      blocks: [
        before.blocks[0],
        { id: "heading-1", type: "heading" as const, text: "Lisbon", level: "heading" as const, weight: "bold" as const, italic: false, underline: false, align: "left" as const },
      ],
    };
    const changed = changedBlockIds(before, after);
    expect(agentFocusBlockIds(after.blocks, changed)).toEqual(["heading-1"]);
  });
});
