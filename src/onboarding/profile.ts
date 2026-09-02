import { wordmarkLabel, wordmarkStyles, type WordmarkStyleId } from "../blocks/wordmarks";
import type { CatalogBlockKind } from "../receipt";

/** A printer's identity is which wordmark it signs its paper with. */
export const printerIdentityIds = wordmarkStyles.map((style) => style.id);
export type PrinterIdentityId = WordmarkStyleId;

export const useCaseIds = ["reminders", "groceries", "todos", "daily-briefings"] as const;
export type UseCaseId = (typeof useCaseIds)[number];

export type PrinterProfile = {
  completed: boolean;
  ownerFirstName: string;
  identityId: PrinterIdentityId;
  useCaseIds: UseCaseId[];
};

export type PrinterIdentity = {
  id: PrinterIdentityId;
  name: string;
  description: string;
  requiresFirstName: boolean;
  label(firstName: string): string;
};

/** Marks are set in caps on paper; spoken aloud in the app they are just names. */
function spoken(value: string) {
  return value.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

export const printerIdentities: PrinterIdentity[] = wordmarkStyles.map((style) => ({
  id: style.id,
  name: style.name,
  description: style.description,
  // A mark needs the name precisely when the name changes what it says.
  requiresFirstName: style.suggest("").primary !== style.suggest("Sample").primary,
  label: (firstName) => spoken(wordmarkLabel(style.id, firstName)),
}));

export const useCases: Array<{ id: UseCaseId; name: string; description: string }> = [
  { id: "reminders", name: "Reminders", description: "Small things you do not want to miss." },
  { id: "groceries", name: "Grocery lists", description: "A list that follows you around the store." },
  { id: "todos", name: "To-do lists", description: "Plans, priorities, and the day ahead." },
  { id: "daily-briefings", name: "Daily briefings", description: "Weather, agenda, news, and habits." },
];

const recommendations: Record<UseCaseId, CatalogBlockKind[]> = {
  reminders: ["countdown", "checklistGroups"],
  groceries: ["checklistGroups", "mealPlan"],
  todos: ["dailyPlan", "agenda", "habit"],
  "daily-briefings": ["weather", "agenda", "news", "habit"],
};

export const defaultPrinterProfile: PrinterProfile = {
  completed: false,
  ownerFirstName: "",
  identityId: "owners-printer-western",
  useCaseIds: [],
};

export function acceptPrinterProfile(value: unknown): PrinterProfile {
  if (!value || typeof value !== "object") return defaultPrinterProfile;
  const candidate = value as Partial<PrinterProfile>;
  const identityId = printerIdentityIds.includes(candidate.identityId as PrinterIdentityId)
    ? candidate.identityId as PrinterIdentityId
    : defaultPrinterProfile.identityId;
  const selectedUseCases = Array.isArray(candidate.useCaseIds)
    ? [...new Set(candidate.useCaseIds.filter((id): id is UseCaseId => useCaseIds.includes(id as UseCaseId)))]
    : [];
  return {
    completed: Boolean(candidate.completed),
    ownerFirstName: typeof candidate.ownerFirstName === "string" ? candidate.ownerFirstName.trim().slice(0, 40) : "",
    identityId,
    useCaseIds: selectedUseCases,
  };
}

/** What a new receipt needs to know to sign itself. */
export function documentSeed(profile: PrinterProfile) {
  return { ownerFirstName: profile.ownerFirstName, identityId: profile.identityId };
}

export function printerIdentity(profile: PrinterProfile) {
  return printerIdentities.find((identity) => identity.id === profile.identityId) ?? printerIdentities[0];
}

export function printerIdentityLabel(profile: PrinterProfile) {
  return printerIdentity(profile).label(profile.ownerFirstName);
}

export function recommendedBlocks(useCaseSelection: UseCaseId[]) {
  const seen = new Set<CatalogBlockKind>();
  return useCaseSelection.flatMap((id) => recommendations[id] ?? []).filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
