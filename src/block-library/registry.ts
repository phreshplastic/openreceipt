import { blockCatalog, getPrototype } from "../blocks/catalog";
import { geocodeCity, loadWeather, type LoadOptions } from "../blocks/feeds";
import { samplePrototypeData } from "../blocks/fixtures";
import { renderPrototypeBlock, renderPrototypePart, type PrototypePart } from "../blocks/render";
import type { PaperWidthDots, PreviewLocation, PrototypeBlockId } from "../blocks/types";
import { catalogReceiptBlockSchema, createId, type CatalogBlockKind, type CatalogReceiptBlock } from "../receipt/model";

export type LibraryAvailability = "available" | "preview";
export type LibraryDataMode = "Live data" | "Write-in" | "Sample data";

export type LibraryDefinition = {
  id: PrototypeBlockId;
  name: string;
  category: string;
  description: string;
  designNote: string;
  sourceName?: string;
  sourceUrl?: string;
  availability: LibraryAvailability;
  dataMode: LibraryDataMode;
  requiresConfiguration: boolean;
};

export type WeatherInsertConfig = { city: string; unit: "fahrenheit" | "celsius" };
export type CatalogInsertConfig = WeatherInsertConfig | undefined;

export type CatalogDependencies = {
  geocode(query: string, options?: LoadOptions): Promise<PreviewLocation>;
  weather(location: PreviewLocation, unit: "fahrenheit" | "celsius", options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "weather" }>["data"]>;
  now(): Date;
};

const availableKinds = new Set<CatalogBlockKind>(["weather", "agenda", "habit", "dailyPlan"]);
const liveIds = new Set<PrototypeBlockId>(["weather", "air", "surf", "games", "markets", "news", "earthquakes"]);

export const libraryDefinitions: LibraryDefinition[] = blockCatalog.map((prototype) => ({
  ...prototype,
  availability: availableKinds.has(prototype.id as CatalogBlockKind) ? "available" : "preview",
  dataMode: liveIds.has(prototype.id) ? "Live data" : ["habit", "dailyPlan", "groupedChecklist", "workoutLog", "weatherJournal", "mealPlan", "meetingNotes", "packingList"].includes(prototype.id) ? "Write-in" : "Sample data",
  requiresConfiguration: prototype.id === "weather",
}));

export const insertableLibraryDefinitions = libraryDefinitions.filter((definition) => definition.availability === "available");

export function isAvailableCatalogKind(value: string): value is CatalogBlockKind {
  return availableKinds.has(value as CatalogBlockKind);
}

export function getLibraryDefinition(id: string) {
  return libraryDefinitions.find((definition) => definition.id === id);
}

export function listBlockCatalog() {
  return insertableLibraryDefinitions.map(({ id, name, category, description, dataMode, requiresConfiguration }) => ({
    id,
    name,
    category,
    description,
    dataMode,
    requiresConfiguration,
    configuration: id === "weather" ? { city: "City or postal code", unit: ["fahrenheit", "celsius"] } : undefined,
  }));
}

export function renderLibraryPreview(id: PrototypeBlockId, width: PaperWidthDots) {
  return renderPrototypeBlock(id, samplePrototypeData[id] as never, width);
}

export function renderCatalogReceiptPart(block: CatalogReceiptBlock, width: number): PrototypePart {
  return renderPrototypePart(block.kind, block.data as never, width);
}

const defaultDependencies: CatalogDependencies = {
  geocode: geocodeCity,
  weather: loadWeather,
  now: () => new Date(),
};

function dateLabel(now: Date) {
  return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export async function createCatalogBlock(kind: CatalogBlockKind, config?: CatalogInsertConfig, dependencies: CatalogDependencies = defaultDependencies): Promise<CatalogReceiptBlock> {
  const now = dependencies.now();
  if (kind === "weather") {
    if (!config?.city.trim()) throw new Error("Choose a city before adding Daily weather.");
    const location = await dependencies.geocode(config.city);
    const data = await dependencies.weather(location, config.unit);
    return catalogReceiptBlockSchema.parse({
      id: createId(),
      type: "catalog",
      kind,
      definitionVersion: 1,
      config: { location, unit: config.unit },
      data,
      refreshedAt: now.toISOString(),
      stale: false,
    });
  }

  if (kind === "agenda") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1,
    data: {
      date: dateLabel(now),
      events: [
        { id: createId(), start: "9:00", end: "10:00", title: "Focus block", detail: "Keep this hour clear" },
        { id: createId(), start: "12:30", title: "Lunch" },
        { id: createId(), start: "4:30", title: "Wrap up the day" },
      ],
    },
  });

  if (kind === "habit") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1,
    data: {
      title: "Weekly habits",
      period: "Week of __________",
      rows: ["Exercise", "Water", "Read", "Stretch"].map((label) => ({ id: createId(), label, values: [1, 1, 1, 1, 1, 1, 1] })),
    },
  });

  return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind: "dailyPlan", definitionVersion: 1,
    data: {
      dateLabel: `DATE  ${dateLabel(now).toUpperCase()}`,
      title: "Today",
      prioritiesLabel: "Top three",
      scheduleLabel: "Schedule",
      rememberLabel: "Remember",
    },
  });
}

export async function refreshCatalogBlock(block: CatalogReceiptBlock, dependencies: CatalogDependencies = defaultDependencies): Promise<CatalogReceiptBlock> {
  if (block.kind !== "weather") return block;
  try {
    const data = await dependencies.weather(block.config.location, block.config.unit);
    return catalogReceiptBlockSchema.parse({ ...block, data, refreshedAt: dependencies.now().toISOString(), stale: false, refreshError: undefined });
  } catch (error) {
    return catalogReceiptBlockSchema.parse({ ...block, stale: true, refreshError: error instanceof Error ? error.message : "Weather refresh failed." });
  }
}

export function prototypeForLibrary(id: string) {
  return getPrototype(id);
}
