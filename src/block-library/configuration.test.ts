import { describe, expect, it } from "vitest";
import { configDescriptorFor, favoriteInsertPlan, initialConfigValues } from "./configuration";

const home = { location: "Brooklyn", unit: "fahrenheit" as const };
const nowhere = { location: "", unit: "fahrenheit" as const };

describe("favoriteInsertPlan", () => {
  it("inserts live blocks with home-city defaults", () => {
    expect(favoriteInsertPlan("weather", home)).toEqual({
      action: "insert",
      config: { city: "Brooklyn", unit: "fahrenheit" },
    });
  });

  it("opens the library when a required city is still missing", () => {
    expect(favoriteInsertPlan("weather", nowhere)).toEqual({ action: "library" });
    expect(favoriteInsertPlan("air", nowhere)).toEqual({ action: "library" });
  });

  it("inserts write-in blocks that have no configuration form", () => {
    expect(favoriteInsertPlan("agenda", home)).toEqual({ action: "insert" });
    expect(favoriteInsertPlan("habit", nowhere)).toEqual({ action: "insert" });
  });

  it("inserts countdown with its starter event rather than sending the person back to browse", () => {
    expect(favoriteInsertPlan("countdown", home)).toEqual({
      action: "insert",
      config: { event: "Coast trip", date: "Friday, 4 PM", days: 7, label: "Next up" },
    });
  });
});

describe("logo config descriptor", () => {
  const descriptor = configDescriptorFor("logo")!;

  it("defaults size to medium", () => {
    const values = descriptor.defaults(home);
    expect(values.size).toBe("medium");
  });

  it("offers small, medium and large as the size field's options", () => {
    const sizeField = descriptor.fields.find((field) => field.name === "size");
    expect(sizeField?.type).toBe("select");
    expect(sizeField?.type === "select" && sizeField.options.map((option) => option.value)).toEqual(["small", "medium", "large"]);
  });

  it("carries size through toInsertConfig", () => {
    const values = initialConfigValues(descriptor, home);
    const config = descriptor.toInsertConfig(values, home) as { size?: string };
    expect(config.size).toBe("medium");
  });

  it("reads size back from a stored block via fromBlock, defaulting when absent", () => {
    const withSize = descriptor.fromBlock?.({
      id: "1", type: "catalog", kind: "logo", definitionVersion: 1,
      data: { style: "owners-printer-western", primary: "PETE’S", secondary: "PRINTER", size: "large" },
    } as never);
    expect(withSize?.size).toBe("large");

    const withoutSize = descriptor.fromBlock?.({
      id: "1", type: "catalog", kind: "logo", definitionVersion: 1,
      data: { style: "owners-printer-western", primary: "PETE’S", secondary: "PRINTER" },
    } as never);
    expect(withoutSize?.size).toBe("medium");
  });
});
