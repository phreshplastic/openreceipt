import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReceiptState, ReceiptController, receiptDocumentSchema, renderReceiptSvg, StaleReceiptRevisionError } from "../receipt";
import { createDefaultDocument } from "../receipt/templates";
import { samplePrototypeData } from "../blocks/fixtures";
import { prepareReceiptCommands } from "./commands";
import { defaultBlockLibraryPreferences, loadBlockLibraryPreferences, saveBlockLibraryPreferences, toggleFavorite } from "./preferences";
import { createCatalogBlock, refreshCatalogBlock, type CatalogDependencies } from "./registry";

const now = new Date("2026-08-31T12:00:00.000Z");
const location = { name: "Brooklyn, New York", latitude: 40.6782, longitude: -73.9442, timezone: "America/New_York" };
const weather = structuredClone(samplePrototypeData.weather);
const dependencies: CatalogDependencies = {
  geocode: vi.fn(async () => location),
  weather: vi.fn(async () => weather),
  air: vi.fn(async () => structuredClone(samplePrototypeData.air)),
  markets: vi.fn(async () => structuredClone(samplePrototypeData.markets)),
  news: vi.fn(async () => structuredClone(samplePrototypeData.news)),
  surf: vi.fn(async () => structuredClone(samplePrototypeData.surf)),
  games: vi.fn(async () => structuredClone(samplePrototypeData.games)),
  earthquakes: vi.fn(async () => structuredClone(samplePrototypeData.earthquakes)),
  now: () => now,
};

describe("Block Library registry", () => {
  it("creates four validated, printable catalog blocks", async () => {
    const blocks = await Promise.all([
      createCatalogBlock("weather", { city: "Brooklyn", unit: "fahrenheit" }, dependencies),
      createCatalogBlock("agenda", undefined, dependencies),
      createCatalogBlock("habit", undefined, dependencies),
      createCatalogBlock("dailyPlan", undefined, dependencies),
    ]);
    for (const width of [576, 420] as const) {
      const document = createDefaultDocument();
      document.page = width === 576 ? { paperWidthMm: 80, printableWidthDots: 576, paddingDots: 28 } : { paperWidthMm: 58, printableWidthDots: 420, paddingDots: 22 };
      document.blocks = blocks;
      const rendered = renderReceiptSvg(document);
      expect(rendered.blocks).toHaveLength(4);
      expect(rendered.svg).not.toMatch(/NaN|undefined/);
      expect(rendered.width).toBe(width);
    }
  });

  it("adds a logo at the size chosen in the insert form, not the schema default", async () => {
    // The size picked in the library form used to be discarded and re-derived from the
    // schema default, so choosing Large silently produced a medium mark.
    const large = await createCatalogBlock("logo", { style: "owners-printer-western", primary: "PETE'S", size: "large" }, dependencies);
    const small = await createCatalogBlock("logo", { style: "owners-printer-western", primary: "PETE'S", size: "small" }, dependencies);
    const fallback = await createCatalogBlock("logo", { style: "owners-printer-western", primary: "PETE'S" }, dependencies);
    if (large.kind !== "logo" || small.kind !== "logo" || fallback.kind !== "logo") throw new Error("expected logo blocks");

    expect(large.data.size).toBe("large");
    expect(small.data.size).toBe("small");
    expect(fallback.data.size).toBe("medium");

    // And the chosen size has to reach the paper, not just the stored block.
    const heightOf = (block: typeof large) => {
      const document = createDefaultDocument();
      document.blocks = [block];
      return renderReceiptSvg(document).height;
    };
    expect(heightOf(small)).toBeLessThan(heightOf(large));
  });

  it("migrates V1 documents to V2 without changing their core blocks", () => {
    // A V1 document predates library blocks, so it can only ever have held core ones.
    const current = createDefaultDocument();
    const core = current.blocks.filter((block) => block.type !== "catalog");
    const legacy = { ...current, schemaVersion: 1 as const, blocks: core };
    const migrated = receiptDocumentSchema.parse(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.blocks).toEqual(core);
  });

  it("preserves the last weather snapshot and marks a failed refresh stale", async () => {
    const block = await createCatalogBlock("weather", { city: "Brooklyn", unit: "celsius" }, dependencies);
    if (block.kind !== "weather") throw new Error("Expected weather");
    const failed = await refreshCatalogBlock(block, { ...dependencies, weather: vi.fn(async () => { throw new Error("Network unavailable"); }) });
    expect(failed.kind).toBe("weather");
    if (failed.kind !== "weather") throw new Error("Expected weather");
    expect(failed.data).toEqual(block.data);
    expect(failed.stale).toBe(true);
    expect(failed.refreshError).toBe("Network unavailable");
  });

  it("prepares catalog insertion without mutating the receipt and rejects a stale commit", async () => {
    const controller = new ReceiptController(createReceiptState(createDefaultDocument(), 4));
    const before = controller.state.document.blocks.length;
    const document = await prepareReceiptCommands(controller.state, 4, [{ type: "insertCatalogBlock", kind: "agenda", index: 1 }], dependencies);
    expect(controller.state.document.blocks).toHaveLength(before);
    expect(document.blocks).toHaveLength(before + 1);
    controller.apply(4, [{ type: "setTitle", title: "Human edit" }]);
    expect(() => controller.commitPrepared(4, document)).toThrow(StaleReceiptRevisionError);
  });
});

describe("Block Library preferences", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };

  beforeEach(() => values.clear());

  it("starts empty, persists order, and removes favorites", () => {
    let preferences = toggleFavorite(defaultBlockLibraryPreferences, "agenda");
    preferences = toggleFavorite(preferences, "habit");
    saveBlockLibraryPreferences(preferences, storage);
    expect(loadBlockLibraryPreferences(storage).favoriteIds).toEqual(["agenda", "habit"]);
    expect(toggleFavorite(preferences, "agenda").favoriteIds).toEqual(["habit"]);
  });

  it("drops design-study and malformed favorite IDs", () => {
    storage.setItem("petes-printer:block-library:v1", JSON.stringify({ version: 1, favoriteIds: ["weather", "delivery", "weather", 42] }));
    expect(loadBlockLibraryPreferences(storage).favoriteIds).toEqual(["weather"]);
  });
});
