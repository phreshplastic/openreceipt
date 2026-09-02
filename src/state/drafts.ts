import { createId, receiptDocumentSchema, type ReceiptDocumentV2 } from "../receipt/model";

const DRAFTS_KEY = "petes-printer:drafts:v1";

/** Both lists are capped so a browser-local shelf of saved documents cannot grow without bound. */
const MAX_STORED_ITEMS = 20;

export type StoredDraft = { id: string; title: string; document: ReceiptDocumentV2; updatedAt: string };
export type StoredTemplate = { id: string; name: string; document: ReceiptDocumentV2; createdAt: string };
export type DraftStore = { version: 1; activeId: string; drafts: StoredDraft[]; templates: StoredTemplate[] };

type DraftStorage = Pick<Storage, "getItem" | "setItem">;

/** Every user template id lives in this namespace so it can never collide with a built-in id like "blank" or "checklist". */
const USER_TEMPLATE_PREFIX = "user:";

export const emptyDraftStore: DraftStore = { version: 1, activeId: "", drafts: [], templates: [] };

/**
 * Drops the oldest entries once a list exceeds the cap.
 *
 * A draft is a one-off a person comes back to, so the copy they have touched least
 * recently is the one they are least likely to miss — eviction order is `updatedAt`.
 * A template only records when it was minted (it isn't "touched" on reuse the way a
 * draft is), so the same intuition — forget the thing least likely to be missed —
 * reduces to "oldest created" there. Both lists pass their own timestamp field in.
 */
function evictOldest<T>(items: T[], timestampOf: (item: T) => string): T[] {
  if (items.length <= MAX_STORED_ITEMS) return items;
  return [...items].sort((a, b) => timestampOf(a).localeCompare(timestampOf(b))).slice(items.length - MAX_STORED_ITEMS);
}

function parseStoredDraft(candidate: unknown): StoredDraft | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const value = candidate as Partial<StoredDraft>;
  if (typeof value.id !== "string" || typeof value.title !== "string" || typeof value.updatedAt !== "string") return undefined;
  try {
    return { id: value.id, title: value.title, document: receiptDocumentSchema.parse(value.document), updatedAt: value.updatedAt };
  } catch {
    return undefined;
  }
}

function parseStoredTemplate(candidate: unknown): StoredTemplate | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const value = candidate as Partial<StoredTemplate>;
  if (typeof value.id !== "string" || !value.id.startsWith(USER_TEMPLATE_PREFIX)) return undefined;
  if (typeof value.name !== "string" || typeof value.createdAt !== "string") return undefined;
  try {
    return { id: value.id, name: value.name, document: receiptDocumentSchema.parse(value.document), createdAt: value.createdAt };
  } catch {
    return undefined;
  }
}

/**
 * Never throws. Corrupt JSON, a wrong version, a document that fails schema
 * validation, or `localStorage` being unavailable (Safari private mode throws on
 * access) all degrade to an empty store. Each stored draft/template is validated on
 * its own, so one rotted entry is dropped without discarding its still-good siblings.
 */
export function loadDraftStore(storage?: DraftStorage): DraftStore {
  try {
    // `localStorage` is resolved inside the try, not as a default parameter: reading the
    // property itself throws in a sandboxed frame and in Safari's private mode, and a
    // default parameter is evaluated before the function body can catch it.
    const raw = (storage ?? localStorage).getItem(DRAFTS_KEY);
    if (!raw) return emptyDraftStore;
    const value = JSON.parse(raw) as Partial<DraftStore> | null;
    if (!value || value.version !== 1) return emptyDraftStore;
    const drafts = Array.isArray(value.drafts) ? value.drafts.map(parseStoredDraft).filter((draft): draft is StoredDraft => draft !== undefined) : [];
    const templates = Array.isArray(value.templates) ? value.templates.map(parseStoredTemplate).filter((template): template is StoredTemplate => template !== undefined) : [];
    const activeId = typeof value.activeId === "string" && drafts.some((draft) => draft.id === value.activeId) ? value.activeId : "";
    return { version: 1, activeId, drafts, templates };
  } catch {
    return emptyDraftStore;
  }
}

/**
 * Reports whether the shelf reached storage. Twenty drafts and twenty templates are whole
 * receipt documents, so this is the one store in the app that can realistically exhaust the
 * quota — and a save that silently throws would take the editor down with it. Callers are
 * expected to tell the person when this returns false rather than pretend the save happened.
 */
export function persistDraftStore(store: DraftStore, storage?: DraftStorage): boolean {
  try {
    (storage ?? localStorage).setItem(DRAFTS_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function sameDraftContents(left: { title: string; document: ReceiptDocumentV2 }, right: { title: string; document: ReceiptDocumentV2 }): boolean {
  return left.title === right.title && JSON.stringify(left.document) === JSON.stringify(right.document);
}

/**
 * Creates a new draft (minting an id) or updates an existing one when `id` matches a
 * draft already in the store. The saved draft becomes `activeId`, so auto-save and
 * an explicit Save as draft share the same object rather than forking a copy.
 * Re-saving unchanged contents keeps `updatedAt`, so browsing the shelf does not restack it.
 */
export function saveDraft(store: DraftStore, input: { id?: string; title: string; document: ReceiptDocumentV2 }): DraftStore {
  const existing = input.id ? store.drafts.find((draft) => draft.id === input.id) : undefined;
  const id = existing ? existing.id : createId();
  // Browsing the shelf is not an edit. Re-saving the same title and document must
  // keep updatedAt, or clicking through drafts restacks the list to "just now".
  if (existing && sameDraftContents(existing, input)) {
    return store.activeId === id ? store : { ...store, activeId: id };
  }
  const draft: StoredDraft = { id, title: input.title, document: input.document, updatedAt: new Date().toISOString() };
  const withoutExisting = store.drafts.filter((candidate) => candidate.id !== id);
  const drafts = evictOldest([...withoutExisting, draft], (candidate) => candidate.updatedAt);
  return { ...store, drafts, activeId: id };
}

export function renameDraft(store: DraftStore, id: string, title: string): DraftStore {
  const drafts = store.drafts.map((draft) => (draft.id === id ? { ...draft, title, updatedAt: new Date().toISOString() } : draft));
  return { ...store, drafts };
}

/**
 * Document-style names so a shelf of new receipts is scannable: Untitled, Untitled 2, …
 * The first unused stem wins; later copies number from 2. Matching is case-insensitive
 * so "untitled" and "Untitled" count as the same name.
 */
export function uniqueDraftTitle(base: string, taken: Iterable<string>): string {
  const stem = base.trim() || "Untitled";
  const used = new Set([...taken].map((title) => title.trim().toLowerCase()));
  if (!used.has(stem.toLowerCase())) return stem;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} ${n}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem} ${Date.now()}`;
}

export function deleteDraft(store: DraftStore, id: string): DraftStore {
  const drafts = store.drafts.filter((draft) => draft.id !== id);
  const activeId = store.activeId === id ? "" : store.activeId;
  return { ...store, drafts, activeId };
}

/** Sets the shelf's active draft. A no-op (returns `store` unchanged) if `id` isn't "" or an id already in `drafts`. */
export function setActiveDraft(store: DraftStore, id: string): DraftStore {
  if (id !== "" && !store.drafts.some((draft) => draft.id === id)) return store;
  return { ...store, activeId: id };
}

/**
 * Creates a new user template or updates an existing one when `id` matches a
 * template already in the store. The id is never taken from the caller for a new
 * template — it is always minted here as `user:<uuid>` — so a saved template can
 * never collide with a built-in id such as "blank" or "checklist".
 */
export function saveTemplate(store: DraftStore, input: { id?: string; name: string; document: ReceiptDocumentV2 }): DraftStore {
  const existing = input.id ? store.templates.find((template) => template.id === input.id) : undefined;
  const id = existing ? existing.id : `${USER_TEMPLATE_PREFIX}${createId()}`;
  // createdAt is preserved across an update — it names when the template was minted, not when it was last touched.
  const template: StoredTemplate = { id, name: input.name, document: input.document, createdAt: existing?.createdAt ?? new Date().toISOString() };
  const withoutExisting = store.templates.filter((candidate) => candidate.id !== id);
  const templates = evictOldest([...withoutExisting, template], (candidate) => candidate.createdAt);
  return { ...store, templates };
}

export function deleteTemplate(store: DraftStore, id: string): DraftStore {
  return { ...store, templates: store.templates.filter((template) => template.id !== id) };
}

export function isUserTemplateId(id: string): boolean {
  return id.startsWith(USER_TEMPLATE_PREFIX);
}
