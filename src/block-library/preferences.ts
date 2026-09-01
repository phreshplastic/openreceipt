import { isAvailableCatalogKind } from "./registry";
import type { CatalogBlockKind } from "../receipt/model";

const PREFERENCES_KEY = "petes-printer:block-library:v1";

export type BlockLibraryPreferences = { version: 1; favoriteIds: CatalogBlockKind[] };

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export const defaultBlockLibraryPreferences: BlockLibraryPreferences = { version: 1, favoriteIds: [] };

export function loadBlockLibraryPreferences(storage: PreferenceStorage = localStorage): BlockLibraryPreferences {
  try {
    const value = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? "null") as Partial<BlockLibraryPreferences> | null;
    if (!value || value.version !== 1 || !Array.isArray(value.favoriteIds)) return defaultBlockLibraryPreferences;
    return { version: 1, favoriteIds: [...new Set(value.favoriteIds.filter((id): id is CatalogBlockKind => typeof id === "string" && isAvailableCatalogKind(id)))] };
  } catch {
    return defaultBlockLibraryPreferences;
  }
}

export function saveBlockLibraryPreferences(preferences: BlockLibraryPreferences, storage: PreferenceStorage = localStorage) {
  storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function toggleFavorite(preferences: BlockLibraryPreferences, id: CatalogBlockKind): BlockLibraryPreferences {
  const favoriteIds = preferences.favoriteIds.includes(id) ? preferences.favoriteIds.filter((candidate) => candidate !== id) : [...preferences.favoriteIds, id];
  return { version: 1, favoriteIds };
}
