import { blockCatalog, getPrototype } from "../blocks/catalog";
import { configDescriptorFor, requiresConfiguration } from "./configuration";
import { geocodeCity, loadAir, loadEarthquakes, loadGames, loadMarkets, loadSurf, loadTopStories, loadWeather, type LoadOptions } from "../blocks/feeds";
import { samplePrototypeData } from "../blocks/fixtures";
import { renderPrototypeBlock, renderPrototypePart, type PrototypePart } from "../blocks/render";
import type { PaperWidthDots, PreviewLocation, PrototypeBlockId } from "../blocks/types";
import { catalogReceiptBlockSchema, createId, type CatalogBlockKind, type CatalogReceiptBlock } from "../receipt/model";

export type LibraryAvailability = "available" | "preview";
export type LibraryDataMode = "Live data" | "Write-in" | "Blank form" | "Design study";

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
export type LeagueInsertConfig = { league: string };
export type ChecklistGroupsInsertConfig = { title: string; note?: string; groups: Array<{ name: string; items: Array<{ text: string; checked?: boolean }> }> };
export type CountdownInsertConfig = { event: string; date: string; days: number; label?: string; milestones?: Array<{ label: string; complete?: boolean }> };
export type CatalogInsertConfig = WeatherInsertConfig | LocationInsertConfig | LeagueInsertConfig | ChecklistGroupsInsertConfig | CountdownInsertConfig | undefined;

export type CatalogDependencies = {
  geocode(query: string, options?: LoadOptions): Promise<PreviewLocation>;
  weather(location: PreviewLocation, unit: "fahrenheit" | "celsius", options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "weather" }>["data"]>;
  air(location: PreviewLocation, options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "air" }>["data"]>;
  markets(options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "markets" }>["data"]>;
  news(options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "news" }>["data"]>;
  surf(location: PreviewLocation, options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "surf" }>["data"]>;
  games(league: string, options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "games" }>["data"]>;
  earthquakes(options?: LoadOptions): Promise<Extract<CatalogReceiptBlock, { kind: "earthquakes" }>["data"]>;
  now(): Date;
};

/** Forms that exist to be written on with a pen; only their date label is data. */
const writeInFormKinds = ["dailyPlan", "weatherJournal", "packingList"] as const;
type WriteInFormKind = (typeof writeInFormKinds)[number];

/** Rendered in the playground as design studies; no data source exists, so they cannot be printed. */
export const designStudyIds = new Set<PrototypeBlockId>(["departures", "home", "delivery"]);

const availableKinds = new Set<CatalogBlockKind>([
  "weather", "agenda", "habit", "checklistGroups", "countdown", "news", "air", "markets",
  "mealPlan", "meetingNotes", "workoutLog", "surf", "games", "earthquakes", ...writeInFormKinds,
]);
const liveIds = new Set<PrototypeBlockId>(["weather", "air", "surf", "games", "markets", "news", "earthquakes"]);

export const libraryDefinitions: LibraryDefinition[] = blockCatalog.map((prototype) => ({
  ...prototype,
  availability: availableKinds.has(prototype.id as CatalogBlockKind) ? "available" : "preview",
  // Say what the block will actually do once it is on paper, not what it looks like here.
  dataMode: !availableKinds.has(prototype.id as CatalogBlockKind) ? "Design study"
    : liveIds.has(prototype.id) ? "Live data"
    : (writeInFormKinds as readonly string[]).includes(prototype.id) ? "Blank form"
    : "Write-in",
  requiresConfiguration: requiresConfiguration(prototype.id),
}));

export const insertableLibraryDefinitions = libraryDefinitions.filter((definition) => definition.availability === "available");

export function isAvailableCatalogKind(value: string): value is CatalogBlockKind {
  return availableKinds.has(value as CatalogBlockKind);
}

export function getLibraryDefinition(id: string) {
  return libraryDefinitions.find((definition) => definition.id === id);
}

export function listBlockCatalog() {
  return insertableLibraryDefinitions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    category: definition.category,
    description: definition.description,
    dataMode: definition.dataMode,
    requiresConfiguration: definition.requiresConfiguration,
    // Derived from the one descriptor table, so the modal and this listing cannot drift.
    configuration: configDescriptorFor(definition.id)?.fields.map((field) => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required ?? false,
      ...(field.type === "select" ? { options: field.options.map((option) => option.value) } : {}),
    })),
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
  surf: loadSurf,
  games: loadGames,
  earthquakes: loadEarthquakes,
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

  if (kind === "surf") {
    const place = config as LocationInsertConfig | undefined;
    if (!place?.city?.trim()) throw new Error("Choose a break or coastal town before adding Surf window.");
    const location = await dependencies.geocode(place.city);
    return catalogReceiptBlockSchema.parse({
      id: createId(), type: "catalog", kind, definitionVersion: 1,
      config: { location }, data: await dependencies.surf(location), ...live,
    });
  }

  if (kind === "games") {
    const league = (config as LeagueInsertConfig | undefined)?.league?.trim() || "Basketball";
    return catalogReceiptBlockSchema.parse({
      id: createId(), type: "catalog", kind, definitionVersion: 1,
      config: { league }, data: await dependencies.games(league), ...live,
    });
  }

  if (kind === "earthquakes") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1, data: await dependencies.earthquakes(), ...live,
  });

  if (kind === "mealPlan") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1,
    data: {
      dateLabel: dateLabel(now).toUpperCase(),
      meals: ["Breakfast", "Lunch", "Dinner"].map((name) => ({ id: createId(), name, dishes: [] })),
      prep: ["Defrost", "Pack", "Chop", "Soak"].map((text) => ({ id: createId(), text, checked: false })),
    },
  });

  if (kind === "meetingNotes") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1,
    data: { dateLabel: dateLabel(now).toUpperCase(), decisions: [], actions: [] },
  });

  if (kind === "workoutLog") return catalogReceiptBlockSchema.parse({
    id: createId(), type: "catalog", kind, definitionVersion: 1,
    data: { dateLabel: dateLabel(now).toUpperCase(), exercises: [] },
  });

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

const liveKinds = new Set<CatalogBlockKind>(["weather", "air", "news", "markets", "surf", "games", "earthquakes"]);

/** Every block that carries feed data, and therefore a refresh state. */
export type LiveCatalogBlock = Extract<CatalogReceiptBlock, { refreshedAt: string }>;

export function isLiveCatalogKind(kind: CatalogBlockKind) {
  return liveKinds.has(kind);
}

export function isLiveCatalogBlock(block: CatalogReceiptBlock): block is LiveCatalogBlock {
  return liveKinds.has(block.kind);
}

async function fetchLiveData(block: CatalogReceiptBlock, dependencies: CatalogDependencies) {
  switch (block.kind) {
    case "weather": return dependencies.weather(block.config.location, block.config.unit);
    case "air": return dependencies.air(block.config.location);
    case "surf": return dependencies.surf(block.config.location);
    case "games": return dependencies.games(block.config.league);
    case "news": return dependencies.news();
    case "markets": return dependencies.markets();
    case "earthquakes": return dependencies.earthquakes();
    default: return undefined;
  }
}

/** Refreshing keeps the last good copy when the network fails — a stale forecast still prints. */
export async function refreshCatalogBlock(block: CatalogReceiptBlock, dependencies: CatalogDependencies = defaultDependencies): Promise<CatalogReceiptBlock> {
  if (!liveKinds.has(block.kind)) return block;
  try {
    const data = await fetchLiveData(block, dependencies);
    return catalogReceiptBlockSchema.parse({ ...block, data, refreshedAt: dependencies.now().toISOString(), stale: false, refreshError: undefined });
  } catch (error) {
    return catalogReceiptBlockSchema.parse({ ...block, stale: true, refreshError: error instanceof Error ? error.message : "Refresh failed." });
  }
}

/**
 * Reconfiguring is all-or-nothing. Keeping the old data beside new config would print
 * one city's numbers under another city's heading, so a failure changes nothing at all.
 */
export async function reconfigureCatalogBlock(block: CatalogReceiptBlock, config: CatalogInsertConfig, dependencies: CatalogDependencies = defaultDependencies): Promise<CatalogReceiptBlock> {
  if (configDescriptorFor(block.kind)?.mode !== "live") throw new Error(`${block.kind} blocks are edited directly, not reconfigured.`);
  const rebuilt = await createCatalogBlock(block.kind, config, dependencies);
  return catalogReceiptBlockSchema.parse({ ...rebuilt, id: block.id });
}

export function prototypeForLibrary(id: string) {
  return getPrototype(id);
}
