export type PrintDestination = "printer" | "demo";

const KEY = "petes-printer:print-destination:v1";

type DestinationStorage = Pick<Storage, "getItem" | "setItem">;

export function loadPrintDestination(fallback: PrintDestination, storage: DestinationStorage = localStorage): PrintDestination {
  try {
    const stored = storage.getItem(KEY);
    if (stored === "printer" || stored === "demo") return stored;
  } catch {
    // Private mode and quota errors should not block printing.
  }
  return fallback;
}

export function savePrintDestination(value: PrintDestination, storage: DestinationStorage = localStorage) {
  try {
    storage.setItem(KEY, value);
  } catch {
    // Same as other local-only prefs: a refused write is not a print failure.
  }
}
