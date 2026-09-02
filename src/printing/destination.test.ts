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
    savePrintDestination("demo", storage);
    expect(loadPrintDestination("printer", storage)).toBe("demo");
  });

  it("ignores junk and uses the fallback", () => {
    const storage = new MemoryStorage();
    storage.setItem("petes-printer:print-destination:v1", "laser");
    expect(loadPrintDestination("printer", storage)).toBe("printer");
  });
});
