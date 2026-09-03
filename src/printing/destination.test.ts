import { describe, expect, it } from "vitest";
import { loadPrintDestination, savePrintDestination } from "./destination";

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
});
