export type PrintDestination = "printer" | "demo";
export type PrintAction = "demo" | "setup" | "printer";

const KEY = "petes-printer:print-destination:v2";

/** Demo print is a browser preview. It must never open the Epson setup overlay. */
export function resolvePrintAction(
  destination: PrintDestination,
  printer: { configured: boolean; bridgeOnline: boolean },
): PrintAction {
  if (destination === "demo") return "demo";
  if (!printer.configured || !printer.bridgeOnline) return "setup";
  return "printer";
}

type DestinationStorage = Pick<Storage, "getItem" | "setItem">;

export function loadPrintDestination(fallback: PrintDestination = "demo", storage: DestinationStorage = localStorage): PrintDestination {
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
