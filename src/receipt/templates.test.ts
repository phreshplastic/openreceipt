import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "./templates";

describe("default receipt", () => {
  it("opens on a dated morning brief rather than a blank page", () => {
    const document = createDefaultDocument();
    const headings = document.blocks.filter((block) => block.type === "heading");
    const notes = document.blocks.filter((block) => block.type === "text").map((block) => (block.type === "text" ? block.text : undefined));
    const checklist = document.blocks.find((block) => block.type === "checklist");
    const countdown = document.blocks.find((block) => block.type === "catalog" && block.kind === "countdown");
    const logo = document.blocks[0];
    const expectedDate = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

    expect(document.title).toBe("Morning brief");
    expect(headings.map((block) => (block.type === "heading" ? block.text : undefined))).toEqual(["Morning brief", "Today"]);
    expect(notes).toEqual([expectedDate, "Quiet morning. Shop on the way home."]);
    expect(checklist && checklist.type === "checklist" ? checklist.items.map((item) => item.text) : []).toEqual([
      "Six-mile loop",
      "Eggs, milk, greens",
      "Laundry",
      "Charger for Lisbon",
    ]);
    expect(document.blocks.filter((block) => block.type === "divider").every((block) => block.type === "divider" && block.style === "solid")).toBe(true);
    expect(countdown && countdown.type === "catalog" && countdown.kind === "countdown" ? countdown.data.event : undefined).toBe("Lisbon");
    expect(countdown && countdown.type === "catalog" && countdown.kind === "countdown" ? countdown.data.days : undefined).toBe(12);
    expect(logo.type === "catalog" && logo.kind === "logo" ? logo.data.primary : undefined).toBe("PETE’S");
  });
});
