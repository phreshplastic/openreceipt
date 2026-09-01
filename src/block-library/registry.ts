import { blockCatalog, getPrototype } from "../blocks/catalog";
import { geocodeCity, loadAir, loadMarkets, loadTopStories, loadWeather, type LoadOptions } from "../blocks/feeds";
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
export type LocationInsertConfig = { city: string };
export type ChecklistGroupsInsertConfig = { title: string; note?: string; groups: Array<{ name: string; items: Array<{ text: string; checked?: boolean }> }> };
export type CountdownInsertConfig = { event: string; date: string; days: number; label?: string; milestones?: Array<{ label: string; complete?: boolean }> };
export type CatalogInsertConfig = WeatherInsertConfig | LocationInsertConfig | ChecklistGroupsInsertConfig | CountdownInsertConfig | undefined;

export type CatalogDependencies = {
  geocode(query: string, options?: LoadOptions): Promise<PreviewLocation>;
  weather(location: PreviewLocation, unit: "fahrenheit" | "celsius", options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "weather" }>["data"]>;
  air(location: PreviewLocation, options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "air" }>["data"]>;
  markets(options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "markets" }>["data"]>;
  news(options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "news" }>["data"]>;
  now(): Date;
};

const writeInFormKinds = ["dailyPlan", "groupedChecklist", "workoutLog", "weatherJournal", "mealPlan", "meetingNotes", "packingList"] as const;
type WriteInFormKind = (typeof writeInFormKinds)[number];

const availableKinds = new Set<CatalogBlockKind>([
  "weather", "agenda", "habit", "checklistGroups", "countdown", "news", "air", "markets", ...writeInFormKinds,
]);
const liveIds = new Set<PrototypeBlockId>(["weather", "air", "surf", "games", "markets", "news", "earthquakes"]);

export const libraryDefinitions: LibraryDefinition[] = blockCatalog.map((prototype) => ({
  ...prototype,
  availability: availableKinds.has(prototype.id as CatalogBlockKind) ? "available" : "preview",
  dataMode: liveIds.has(prototype.id) ? "Live data"
    : ["habit", "checklistGroups", "countdown", ...writeInFormKinds].includes(prototype.id) ? "Write-in"
    : "Sample data",
  requiresConfiguration: ["weather", "air", "checklistGroups", "countdown"].includes(prototype.id),
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
    configuration: id === "weather" ? { city: "City or postal code", unit: ["fahrenheit", "celsius"] }
      : id === "air" ? { city: "City or postal code" }
      : id === "checklistGroups" ? { title: "List title", groups: "Named groups of items" }
      : id === "countdown" ? { event: "What you are counting down to", date: "Human-readable date", days: "Whole days remaining" }
      : undefined,
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
  air: loadAir,
  markets: loadMarkets,
  news: loadTopStories,
  now: () => new Date(),
};

function isWriteInFormKind(kind: CatalogBlockKind): kind is WriteInFormKind {
  return (writeInFormKinds as readonly string[]).includes(kind);
}

function dateLabel(now: Date) {
  return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export async function createCatalogBlock(kind: CatalogBlockKind, config?: CatalogInsertConfig, dependencies: CatalogDependencies = defaultDependencies): Promise<CatalogReceiptBlock> {
  const now = dependencies.now();
  const live = { refreshedAt: now.toISOString(), stale: false };

  if (kind === "weather") {
    const weather = config as WeatherInsertConfig | undefined;
    if (!weather?.city?.trim()) throw new Error("Choose a city before adding Daily weather.");
    const location = await dependencies.geocode(weather.city);
    const data = await dependencies.weather(location, weather.unit ?? "fahrenheit");
    return catalogReceiptBlockSchema.parse({
      id: createId(), type: "catalog", kind, definitionVersion: 1,
      config: { location, unit: weather.unit ?? "fahrenheit" }, data, ...live,
    });
  }

  if (kind === "air") {
    const place = config as LocationInsertConfig | undefined;
    if (!place?.city?.trim()) throw new Error("Choose a city before adding Air quality.");
    const location = await dependencies.geocode(place.city);
    return catalogReceiptBlockSchema.parse({
      id: createId(), type: "catalog", kind, definitionVersion: 1,
      config: { location }, data: await dependencies.air(location), ...live,
    });
  }

  if (kind === "news") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1, data: await dependencies.news(), ...live,
  });

  if (kind === "markets") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1, data: await dependencies.markets(), ...live,
  });

  if (kind === "checklistGroups") {
    const list = config as ChecklistGroupsInsertConfig | undefined;
    if (!list?.groups?.length) throw new Error("A grouped list needs at least one group of items.");
    return catalogReceiptBlockSchema.parse({
      id: createId(), type: "catalog", kind, definitionVersion: 1,
      data: {
        title: list.title?.trim() || "Checklist",
        note: list.note?.trim() || undefined,
        groups: list.groups.map((group) => ({
          name: group.name,
          items: group.items.map((item) => ({ text: item.text, checked: item.checked ?? false })),
        })),
      },
    });
  }

  if (kind === "countdown") {
    const event = config as CountdownInsertConfig | undefined;
    if (!event?.event?.trim()) throw new Error("A countdown needs something to count down to.");
    return catalogReceiptBlockSchema.parse({
      id: createId(), type: "catalog", kind, definitionVersion: 1,
      data: {
        label: event.label?.trim() || "Next up",
        event: event.event,
        date: event.date,
        days: event.days,
        milestones: event.milestones?.length
          ? event.milestones.map((milestone) => ({ label: milestone.label, complete: milestone.complete ?? false }))
          : [{ label: "Planned", complete: true }, { label: "Ready", complete: false }, { label: "Go", complete: false }],
      },
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

  if (kind === "dailyPlan") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1,
    data: {
      dateLabel: `DATE  ${dateLabel(now).toUpperCase()}`,
      title: "Today",
      prioritiesLabel: "Top three",
      scheduleLabel: "Schedule",
      rememberLabel: "Remember",
    },
  });

  if (isWriteInFormKind(kind)) return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1,
    data: { dateLabel: dateLabel(now).toUpperCase() },
  });

  throw new Error(`${kind} cannot be added to a receipt yet.`);
}

export async function refreshCatalogBlock(block: CatalogReceiptBlock, dependencies: CatalogDependencies = defaultDependencies): Promise<CatalogReceiptBlock> {
  if (block.kind !== "weather" && block.kind !== "air" && block.kind !== "news" && block.kind !== "markets") return block;
  try {
    const data = block.kind === "weather" ? await dependencies.weather(block.config.location, block.config.unit)
      : block.kind === "air" ? await dependencies.air(block.config.location)
      : block.kind === "news" ? await dependencies.news()
      : await dependencies.markets();
    return catalogReceiptBlockSchema.parse({ ...block, data, refreshedAt: dependencies.now().toISOString(), stale: false, refreshError: undefined });
  } catch (error) {
    return catalogReceiptBlockSchema.parse({ ...block, stale: true, refreshError: error instanceof Error ? error.message : "Refresh failed." });
  }
}

export function prototypeForLibrary(id: string) {
  return getPrototype(id);
}
