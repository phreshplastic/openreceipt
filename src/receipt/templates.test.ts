import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "./templates";

describe("default receipt", () => {
  it("opens on a dated morning briefing rather than a blank page", () => {
    const document = createDefaultDocument();
    const headings = document.blocks.filter((block) => block.type === "heading");
    const date = document.blocks.find((block) => block.type === "text");
    const checklist = document.blocks.find((block) => block.type === "checklist");
    const countdown = document.blocks.find((block) => block.type === "catalog" && block.kind === "countdown");
    const logo = document.blocks[0];
    const expectedDate = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

    expect(document.title).toBe("Morning briefing");
    expect(headings.map((block) => (block.type === "heading" ? block.text : undefined))).toEqual(["Morning briefing", "To do"]);
    expect(date && date.type === "text" ? date.text : undefined).toBe(expectedDate);
    expect(checklist && checklist.type === "checklist" ? checklist.items.map((item) => item.text) : []).toEqual([
      "Run 6 miles at tempo pace",
      "Buy groceries at Whole Foods",
      "Run laundry",
      "Charge the camera batteries",
    ]);
    expect(document.blocks.filter((block) => block.type === "divider").every((block) => block.type === "divider" && block.style === "solid")).toBe(true);
    expect(countdown && countdown.type === "catalog" && countdown.kind === "countdown" ? countdown.data.event : undefined).toBe("Portugal trip");
    expect(countdown && countdown.type === "catalog" && countdown.kind === "countdown" ? countdown.data.days : undefined).toBe(12);
    expect(logo.type === "catalog" && logo.kind === "logo" ? logo.data.primary : undefined).toBe("PETE’S");
  });
});
