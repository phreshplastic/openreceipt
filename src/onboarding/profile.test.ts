import { describe, expect, it } from "vitest";
import { acceptPrinterProfile, printerIdentityLabel, recommendedBlocks } from "./profile";

describe("printer profile", () => {
  it("speaks a mark's own words, whichever mark it is", () => {
    const label = (ownerFirstName: string, identityId: string) =>
      printerIdentityLabel(acceptPrinterProfile({ completed: true, ownerFirstName, identityId, useCaseIds: [] }));

    expect(label("Maya", "owners-printer-western")).toBe("Maya’s Printer");
    expect(label("James", "owners-printer-western")).toBe("James’ Printer");
    expect(label("Maya", "masthead-press")).toBe("Maya’s Printer");
    expect(label("", "kitchen-dispatch")).toBe("Pete’s Printer");
  });

  it("drops invalid stored values", () => {
    expect(acceptPrinterProfile({ completed: true, ownerFirstName: "  Pete  ", identityId: "unknown", useCaseIds: ["todos", "unknown", "todos"] })).toEqual({
      completed: true,
      ownerFirstName: "Pete",
      identityId: "owners-printer-western",
      useCaseIds: ["todos"],
    });
  });

  it("deduplicates recommendations while preserving use-case order", () => {
    expect(recommendedBlocks(["groceries", "daily-briefings", "todos"])).toEqual([
      "checklistGroups", "mealPlan", "weather", "agenda", "news", "habit", "dailyPlan",
    ]);
  });
});
