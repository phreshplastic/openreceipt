import { describe, expect, it } from "vitest";
import { loadPrintDestination, resolvePrintAction, savePrintDestination } from "./destination";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("print destination", () => {
  it("returns the fallback when nothing is stored", () => {
    expect(loadPrintDestination("demo", new MemoryStorage())).toBe("demo");
    expect(loadPrintDestination("printer", new MemoryStorage())).toBe("printer");
  });

  it("round-trips a chosen destination", () => {
    const storage = new MemoryStorage();
    savePrintDestination("printer", storage);
    expect(loadPrintDestination("demo", storage)).toBe("printer");
  });

  it("ignores junk and uses the fallback", () => {
    const storage = new MemoryStorage();
    storage.setItem("petes-printer:print-destination:v2", "laser");
    expect(loadPrintDestination("demo", storage)).toBe("demo");
  });

  it("never sends demo print through Epson setup", () => {
    expect(resolvePrintAction("demo", { configured: false, bridgeOnline: false })).toBe("demo");
    expect(resolvePrintAction("demo", { configured: true, bridgeOnline: true })).toBe("demo");
  });

  it("opens setup only for an unready Epson destination", () => {
    expect(resolvePrintAction("printer", { configured: false, bridgeOnline: true })).toBe("setup");
    expect(resolvePrintAction("printer", { configured: true, bridgeOnline: false })).toBe("setup");
    expect(resolvePrintAction("printer", { configured: true, bridgeOnline: true })).toBe("printer");
  });
});
