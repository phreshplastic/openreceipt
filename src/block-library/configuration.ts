import { defaultWordmarkSize, defaultWordmarkStyleId, isWordmarkSize, isWordmarkStyleId, suggestWordmark, wordmarkSizeIds, wordmarkStyles, type WordmarkStyleId } from "../blocks/wordmarks";
import type { CatalogBlockKind, CatalogReceiptBlock } from "../receipt/model";
import type { UnitPreference } from "../state/defaults";
import type { CatalogInsertConfig } from "./registry";

export type UserDefaults = { location: string; unit: UnitPreference; ownerFirstName?: string };

type FieldBase = {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
};

export type ConfigField =
  | (FieldBase & { type: "text"; placeholder?: string; maxLength?: number })
  | (FieldBase & { type: "location" })
  | (FieldBase & { type: "select"; options: { value: string; label: string }[] })
  | (FieldBase & { type: "number"; min?: number; max?: number })
  | (FieldBase & { type: "list"; itemLabel: string; min: number; max: number });

export type ConfigValue = string | number | string[];
export type ConfigValues = Record<string, ConfigValue>;

export type ConfigDescriptor = {
  kind: CatalogBlockKind;
  /**
   * "live" — the block's data is wholly derived from this config, so changing it
   * refetches. "data" — the config is just starting content, used before insert
   * only; rebuilding one of these later would discard the human's own edits.
   */
  mode: "live" | "data";
  summary?: string;
  fields: ConfigField[];
  defaults(user: UserDefaults): ConfigValues;
  toInsertConfig(values: ConfigValues, user: UserDefaults): CatalogInsertConfig;
  fromBlock?(block: CatalogReceiptBlock): Partial<ConfigValues>;
};

const text = (values: ConfigValues, name: string) => typeof values[name] === "string" ? (values[name] as string).trim() : "";
const list = (values: ConfigValues, name: string) => Array.isArray(values[name]) ? (values[name] as string[]).map((entry) => entry.trim()).filter(Boolean) : [];
const count = (values: ConfigValues, name: string) => Math.max(0, Math.round(Number(values[name]) || 0));

const descriptors: ConfigDescriptor[] = [
  {
    kind: "logo",
    mode: "data",
    summary: "Pick a mark, then say what it reads. Both lines stay editable on the receipt.",
    fields: [
      { name: "style", type: "select", label: "Mark", options: wordmarkStyles.map((style) => ({ value: style.id, label: style.name })) },
      { name: "primary", type: "text", label: "Name", maxLength: 40, required: true },
      { name: "secondary", type: "text", label: "Line beneath", placeholder: "Optional", maxLength: 40 },
      { name: "size", type: "select", label: "Size", options: wordmarkSizeIds.map((size) => ({ value: size, label: size[0].toUpperCase() + size.slice(1) })) },
    ],
    defaults: (user) => {
      const suggestion = suggestWordmark(defaultWordmarkStyleId, user.ownerFirstName ?? "");
      return { style: defaultWordmarkStyleId, primary: suggestion.primary, secondary: suggestion.secondary, size: defaultWordmarkSize };
    },
    toInsertConfig: (values, user) => {
      const style = isWordmarkStyleId(text(values, "style")) ? text(values, "style") as WordmarkStyleId : defaultWordmarkStyleId;
      const suggestion = suggestWordmark(style, user.ownerFirstName ?? "");
      const chosenSize = text(values, "size");
      const size = isWordmarkSize(chosenSize) ? chosenSize : defaultWordmarkSize;
      return { style, primary: text(values, "primary") || suggestion.primary, secondary: text(values, "secondary") || undefined, size };
    },
    fromBlock: (block) => block.kind === "logo"
      ? { style: block.data.style, primary: block.data.primary, secondary: block.data.secondary ?? "", size: block.data.size ?? defaultWordmarkSize }
      : {} as Partial<ConfigValues>,
  },
  {
    kind: "weather",
    mode: "live",
    summary: "Fetched once when added. Refresh it whenever you want newer numbers.",
    fields: [
      { name: "city", type: "location", label: "City or postal code", required: true },
      { name: "unit", type: "select", label: "Temperature", options: [{ value: "fahrenheit", label: "Fahrenheit" }, { value: "celsius", label: "Celsius" }] },
    ],
    defaults: (user) => ({ city: user.location, unit: user.unit }),
    toInsertConfig: (values, user) => ({ city: text(values, "city"), unit: values.unit === "celsius" ? "celsius" : values.unit === "fahrenheit" ? "fahrenheit" : user.unit }),
    fromBlock: (block) => block.kind === "weather" ? { city: block.config.location.name, unit: block.config.unit } : {} as Partial<ConfigValues>,
  },
  {
    kind: "air",
    mode: "live",
    summary: "Current air quality for one place.",
    fields: [{ name: "city", type: "location", label: "City or postal code", required: true }],
    defaults: (user) => ({ city: user.location }),
    toInsertConfig: (values) => ({ city: text(values, "city") }),
    fromBlock: (block) => block.kind === "air" ? { city: block.config.location.name } : {} as Partial<ConfigValues>,
  },
  {
    kind: "surf",
    mode: "live",
    summary: "Wave height and wind for a coastal spot. Inland places return flat water.",
    fields: [{ name: "city", type: "location", label: "Break or coastal town", required: true }],
    defaults: (user) => ({ city: user.location }),
    toInsertConfig: (values) => ({ city: text(values, "city") }),
    fromBlock: (block) => block.kind === "surf" ? { city: block.config.location.name } : {} as Partial<ConfigValues>,
  },
  {
    kind: "games",
    mode: "live",
    summary: "Today's fixtures for one sport.",
    fields: [{
      name: "league", type: "select", label: "Sport",
      options: [
        { value: "Basketball", label: "Basketball" },
        { value: "Soccer", label: "Soccer" },
        { value: "American Football", label: "American football" },
        { value: "Ice Hockey", label: "Ice hockey" },
        { value: "Baseball", label: "Baseball" },
      ],
    }],
    defaults: () => ({ league: "Basketball" }),
    toInsertConfig: (values) => ({ league: text(values, "league") || "Basketball" }),
    fromBlock: (block) => block.kind === "games" ? { league: block.config.league } : {} as Partial<ConfigValues>,
  },
  {
    kind: "checklistGroups",
    mode: "data",
    summary: "Start with a few groups; add items on the receipt afterwards.",
    fields: [
      { name: "title", type: "text", label: "Title", maxLength: 60, required: true },
      { name: "note", type: "text", label: "Note", placeholder: "Optional", maxLength: 120 },
      { name: "groups", type: "list", label: "Groups", itemLabel: "Group", min: 1, max: 6 },
    ],
    defaults: () => ({ title: "Checklist", note: "", groups: ["Before you go", "Pack"] }),
    toInsertConfig: (values) => ({
      title: text(values, "title") || "Checklist",
      note: text(values, "note") || undefined,
      groups: (list(values, "groups").length ? list(values, "groups") : ["Items"]).map((name) => ({ name, items: [{ text: "New item", checked: false }] })),
    }),
  },
  {
    kind: "countdown",
    mode: "data",
    summary: "A big number of days, with milestones you tick off.",
    fields: [
      { name: "event", type: "text", label: "Counting down to", maxLength: 60, required: true },
      { name: "date", type: "text", label: "Date", placeholder: "Thursday 14 March", maxLength: 40 },
      { name: "days", type: "number", label: "Days left", min: 0, max: 999 },
      { name: "label", type: "text", label: "Eyebrow", placeholder: "Next up", maxLength: 30 },
    ],
    defaults: () => ({ event: "Coast trip", date: "Friday, 4 PM", days: 7, label: "Next up" }),
    toInsertConfig: (values) => ({
      event: text(values, "event") || "Coast trip",
      date: text(values, "date"),
      days: count(values, "days"),
      label: text(values, "label") || undefined,
    }),
  },
];

const byKind = new Map(descriptors.map((descriptor) => [descriptor.kind, descriptor]));

export const configDescriptors = descriptors;

export function configDescriptorFor(kind: string): ConfigDescriptor | undefined {
  return byKind.get(kind as CatalogBlockKind);
}

/** A kind needs configuring precisely when it has a descriptor — no second list to fall out of step. */
export function requiresConfiguration(kind: string): boolean {
  return byKind.has(kind as CatalogBlockKind);
}

export function initialConfigValues(descriptor: ConfigDescriptor, user: UserDefaults, block?: CatalogReceiptBlock): ConfigValues {
  const values = { ...descriptor.defaults(user) };
  for (const [name, value] of Object.entries(block ? descriptor.fromBlock?.(block) ?? {} : {})) {
    if (value !== undefined) values[name] = value;
  }
  return values;
}

export function missingRequiredField(descriptor: ConfigDescriptor, values: ConfigValues): ConfigField | undefined {
  return descriptor.fields.find((field) => {
    if (!field.required) return false;
    if (field.type === "list") return list(values, field.name).length === 0;
    return !text(values, field.name);
  });
}

export type FavoriteInsertPlan =
  | { action: "library" }
  | { action: "insert"; config?: CatalogInsertConfig };

/** Favorites and the “For you” shelf insert immediately when defaults can fill the form. */
export function favoriteInsertPlan(kind: CatalogBlockKind, user: UserDefaults): FavoriteInsertPlan {
  const descriptor = configDescriptorFor(kind);
  if (!descriptor) return { action: "insert" };
  const values = descriptor.defaults(user);
  if (missingRequiredField(descriptor, values)) return { action: "library" };
  return { action: "insert", config: descriptor.toInsertConfig(values, user) };
}
