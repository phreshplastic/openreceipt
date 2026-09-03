import type { ReceiptDocument } from "../receipt/model";
import { createFromTemplateEntry, listTemplateEntries, type DocumentSeed } from "../receipt/templates";
import { loadDraftStore, persistDraftStore, upsertTemplate, type DraftStore } from "./drafts";

export type ReceiptTemplateInfo = { id: string; name: string; kind: "builtin" | "user" };

export type AgentShelf = {
  listTemplates(): ReceiptTemplateInfo[];
  saveTemplate(name: string, document: ReceiptDocument): ReceiptTemplateInfo & { updated: boolean };
  resolveTemplate(idOrName: string, seed?: DocumentSeed): (ReceiptTemplateInfo & { document: ReceiptDocument }) | undefined;
};

export function summarizeTemplates(store: Pick<DraftStore, "templates">): ReceiptTemplateInfo[] {
  return listTemplateEntries(store).map((entry) => ({ id: entry.id, name: entry.name, kind: entry.kind }));
}

export function matchTemplate(store: Pick<DraftStore, "templates">, idOrName: string, seed?: DocumentSeed) {
  const entries = listTemplateEntries(store);
  const needle = idOrName.trim().toLowerCase();
  const entry = entries.find((candidate) => candidate.id === idOrName)
    ?? entries.find((candidate) => candidate.name.trim().toLowerCase() === needle)
    ?? entries.find((candidate) => candidate.name.toLowerCase().includes(needle));
  if (!entry) return undefined;
  const created = createFromTemplateEntry(store, entry.id, seed);
  if (!created) return undefined;
  return { id: created.template.id, name: created.template.name, kind: created.template.kind, document: created.document };
}

/** Fallback when the editor page is not mounted — landing-page tools, tests, first paint. */
export function storageShelf(seed?: DocumentSeed): AgentShelf {
  return {
    listTemplates: () => summarizeTemplates(loadDraftStore()),
    saveTemplate(name, document) {
      const result = upsertTemplate(loadDraftStore(), name, document);
      if (!persistDraftStore(result.store)) throw new Error("This browser would not save the template — it may be out of space.");
      return { id: result.id, name: result.name, kind: "user", updated: result.updated };
    },
    resolveTemplate: (idOrName, resolveSeed) => matchTemplate(loadDraftStore(), idOrName, resolveSeed ?? seed),
  };
}
