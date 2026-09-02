import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../receipt/templates";
import {
  deleteDraft,
  deleteTemplate,
  emptyDraftStore,
  isUserTemplateId,
  loadDraftStore,
  persistDraftStore,
  renameDraft,
  saveDraft,
  saveTemplate,
  setActiveDraft,
  uniqueDraftTitle,
  type DraftStore,
} from "./drafts";

const doc = () => createDefaultDocument();

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

class ThrowingStorage implements Pick<Storage, "getItem" | "setItem"> {
  getItem(): string | null {
    throw new Error("blocked");
  }
  setItem(): void {
    throw new Error("blocked");
  }
}

describe("draft round-trip", () => {
  it("saves two drafts and reloads both with correct titles", () => {
    const storage = new MemoryStorage();
    let store = saveDraft(emptyDraftStore, { title: "Groceries", document: doc() });
    store = saveDraft(store, { title: "Packing list", document: doc() });
    persistDraftStore(store, storage);

    const reloaded = loadDraftStore(storage);
    expect(reloaded.drafts).toHaveLength(2);
    expect(reloaded.drafts.map((draft) => draft.title).sort()).toEqual(["Groceries", "Packing list"]);
  });

  it("makes the saved draft the active one, without forking when the id is reused", () => {
    let store = saveDraft(emptyDraftStore, { title: "Groceries", document: doc() });
    const id = store.activeId;
    expect(id).toBe(store.drafts[0].id);

    store = saveDraft(store, { id, title: "Groceries", document: doc() });
    expect(store.drafts).toHaveLength(1);
    expect(store.activeId).toBe(id);

    store = saveDraft(store, { title: "Packing list", document: doc() });
    expect(store.drafts).toHaveLength(2);
    expect(store.activeId).not.toBe(id);
  });

  it("does not bump updatedAt when the title and document have not changed", () => {
    const first = saveDraft(emptyDraftStore, { title: "Groceries", document: doc() });
    const saved = first.drafts[0];
    const again = saveDraft(first, { id: saved.id, title: saved.title, document: saved.document });
    expect(again).toBe(first);
    expect(again.drafts[0].updatedAt).toBe(saved.updatedAt);
  });

  it("keeps shelf order when re-saving an older draft unchanged", () => {
    let store = saveDraft(emptyDraftStore, { title: "Older", document: doc() });
    const olderId = store.drafts[0].id;
    store = saveDraft(store, { title: "Newer", document: doc() });
    store = {
      ...store,
      drafts: store.drafts.map((draft) => ({
        ...draft,
        updatedAt: draft.id === olderId ? "2026-09-01T12:00:00.000Z" : "2026-09-02T12:00:00.000Z",
      })),
    };
    const older = store.drafts.find((draft) => draft.id === olderId)!;
    expect([...store.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((draft) => draft.title)).toEqual(["Newer", "Older"]);

    store = saveDraft(store, { id: older.id, title: older.title, document: older.document });
    expect([...store.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((draft) => draft.title)).toEqual(["Newer", "Older"]);
    expect(store.drafts.find((draft) => draft.id === olderId)?.updatedAt).toBe("2026-09-01T12:00:00.000Z");
  });

  it("writes a new draft row when the document or title actually changes", () => {
    const document = doc();
    const first = saveDraft(emptyDraftStore, { title: "Groceries", document });
    const saved = first.drafts[0];
    const renamed = saveDraft(first, { id: saved.id, title: "Market list", document: saved.document });
    expect(renamed).not.toBe(first);
    expect(renamed.drafts[0].title).toBe("Market list");

    const edited = { ...saved.document, blocks: saved.document.blocks.map((block) => block.type === "heading" ? { ...block, text: "Edited" } : block) };
    const changed = saveDraft(renamed, { id: saved.id, title: "Market list", document: edited });
    expect(changed).not.toBe(renamed);
    expect(changed.drafts[0].document.blocks.some((block) => block.type === "heading" && block.text === "Edited")).toBe(true);
  });
});

describe("eviction cap", () => {
  it("evicts the least-recently-updated draft once the list exceeds 20", () => {
    let store = emptyDraftStore;
    for (let i = 0; i < 20; i++) {
      store = saveDraft(store, { title: `Draft ${i}`, document: doc() });
    }
    const oldestId = store.drafts[0].id;
    store = saveDraft(store, { title: "Draft 20", document: doc() });

    expect(store.drafts).toHaveLength(20);
    expect(store.drafts.some((draft) => draft.id === oldestId)).toBe(false);
    expect(store.drafts.some((draft) => draft.title === "Draft 20")).toBe(true);
  });

  it("evicts the oldest-created template once the list exceeds 20", () => {
    let store = emptyDraftStore;
    for (let i = 0; i < 20; i++) {
      store = saveTemplate(store, { name: `Template ${i}`, document: doc() });
    }
    const oldestId = store.templates[0].id;
    store = saveTemplate(store, { name: "Template 20", document: doc() });

    expect(store.templates).toHaveLength(20);
    expect(store.templates.some((template) => template.id === oldestId)).toBe(false);
    expect(store.templates.some((template) => template.name === "Template 20")).toBe(true);
  });
});

describe("defensive loading", () => {
  it("drops a corrupt entry while valid siblings survive", () => {
    const storage = new MemoryStorage();
    const good = saveDraft(emptyDraftStore, { title: "Good draft", document: doc() });
    const raw: DraftStore = {
      ...good,
      drafts: [...good.drafts, { id: "broken", title: "Broken", document: { not: "a document" } as never, updatedAt: "not-a-date" }],
    };
    storage.setItem("petes-printer:drafts:v1", JSON.stringify(raw));

    const reloaded = loadDraftStore(storage);
    expect(reloaded.drafts).toHaveLength(1);
    expect(reloaded.drafts[0].title).toBe("Good draft");
  });

  it("yields an empty store when the stored version does not match", () => {
    const storage = new MemoryStorage();
    storage.setItem("petes-printer:drafts:v1", JSON.stringify({ version: 2, activeId: "", drafts: [], templates: [] }));

    expect(loadDraftStore(storage)).toEqual(emptyDraftStore);
  });

  it("yields an empty store on malformed JSON rather than crashing", () => {
    const storage = new MemoryStorage();
    storage.setItem("petes-printer:drafts:v1", "{not json");

    expect(loadDraftStore(storage)).toEqual(emptyDraftStore);
  });

  it("yields an empty store when storage throws on access rather than crashing", () => {
    expect(() => loadDraftStore(new ThrowingStorage())).not.toThrow();
    expect(loadDraftStore(new ThrowingStorage())).toEqual(emptyDraftStore);
  });
});

describe("user template ids", () => {
  it("are prefixed user: and cannot collide with blank or checklist", () => {
    const store = saveTemplate(emptyDraftStore, { name: "My template", document: doc() });
    const id = store.templates[0].id;

    expect(isUserTemplateId(id)).toBe(true);
    expect(id).not.toBe("blank");
    expect(id).not.toBe("checklist");
    expect(id.startsWith("user:")).toBe(true);
  });
});

describe("unique draft titles", () => {
  it("uses the stem, then numbers from 2", () => {
    expect(uniqueDraftTitle("Untitled", [])).toBe("Untitled");
    expect(uniqueDraftTitle("Untitled", ["Untitled"])).toBe("Untitled 2");
    expect(uniqueDraftTitle("Untitled", ["Untitled", "Untitled 2"])).toBe("Untitled 3");
  });

  it("treats an empty stem as Untitled and ignores case", () => {
    expect(uniqueDraftTitle("  ", [])).toBe("Untitled");
    expect(uniqueDraftTitle("Untitled", ["untitled"])).toBe("Untitled 2");
    expect(uniqueDraftTitle("Packing list", ["Packing list"])).toBe("Packing list 2");
  });
});

describe("reducer purity", () => {
  it("does not mutate the input store", () => {
    const store = saveDraft(emptyDraftStore, { title: "Original", document: doc() });
    const frozen = JSON.parse(JSON.stringify(store));

    saveDraft(store, { title: "Another", document: doc() });
    renameDraft(store, store.drafts[0].id, "Renamed");
    deleteDraft(store, store.drafts[0].id);
    setActiveDraft(store, store.drafts[0].id);
    saveTemplate(store, { name: "A template", document: doc() });
    deleteTemplate(store, "user:nonexistent");

    expect(store).toEqual(frozen);
  });
});

describe("storage that is unavailable rather than merely failing", () => {
  it("survives a localStorage getter that throws, with no storage argument", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() { throw new Error("blocked"); },
    });
    try {
      // The real failure is reading the property, which a default parameter would have
      // evaluated before the function body could catch it.
      expect(() => loadDraftStore()).not.toThrow();
      expect(loadDraftStore()).toEqual(emptyDraftStore);
      expect(persistDraftStore(emptyDraftStore)).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });

  it("reports a failed write instead of throwing when the quota is exhausted", () => {
    expect(persistDraftStore(emptyDraftStore, new ThrowingStorage())).toBe(false);
    expect(persistDraftStore(emptyDraftStore, new MemoryStorage())).toBe(true);
  });
});
