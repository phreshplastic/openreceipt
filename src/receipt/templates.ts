import { createLogoData, defaultWordmarkStyleId, isWordmarkStyleId, type WordmarkStyleId } from "../blocks/wordmarks";
import type { DraftStore } from "../state/drafts";
import { createId, receiptDocumentSchema, type ReceiptDocumentV2 } from "./model";

/** What the receipt knows about whose printer this is, before any block exists. */
export type DocumentSeed = { ownerFirstName?: string; identityId?: WordmarkStyleId };

export type ReceiptTemplate = {
  id: string;
  revision: number;
  name: string;
  description: string;
  create: (seed?: DocumentSeed) => ReceiptDocumentV2;
};

function seedStyle(seed: DocumentSeed) {
  return seed.identityId && isWordmarkStyleId(seed.identityId) ? seed.identityId : defaultWordmarkStyleId;
}

/** Every receipt opens with a sign, so the paper is signed before it says anything. */
export function createLogoBlock(seed: DocumentSeed = {}) {
  return {
    id: createId(),
    type: "catalog" as const,
    kind: "logo" as const,
    definitionVersion: 1 as const,
    data: createLogoData(seedStyle(seed), seed.ownerFirstName ?? ""),
  };
}

export type ReminderDraft = {
  title: string;
  message: string;
  when?: string;
  checklist?: string[];
};

const page = { paperWidthMm: 80 as const, printableWidthDots: 576 as const, paddingDots: 28 };

/**
 * The first receipt says what day it is, so it has to be read from the clock rather
 * than written down. A frozen date is the first thing a person notices is wrong.
 */
function today(now = new Date()) {
  return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function blankReceipt(seed: DocumentSeed = {}): ReceiptDocumentV2 {
  return receiptDocumentSchema.parse({
    schemaVersion: 2,
    id: createId(),
    title: "Today",
    page,
    blocks: [
      createLogoBlock(seed),
      { id: createId(), type: "heading", text: "Today", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
      { id: createId(), type: "text", text: today(), size: "small", weight: "medium", italic: false, underline: false, align: "left" },
      { id: createId(), type: "divider", style: "dashed" },
      { id: createId(), type: "checklist", items: [
        { id: createId(), text: "Pick up the charger", checked: false },
        { id: createId(), text: "Write the note", checked: false },
        { id: createId(), text: "Leave by four", checked: false },
      ] },
      { id: createId(), type: "divider", style: "solid" },
    ],
  });
}

function checklistReceipt(seed: DocumentSeed = {}): ReceiptDocumentV2 {
  return receiptDocumentSchema.parse({
    schemaVersion: 2,
    id: createId(),
    title: "Packing list",
    page,
    blocks: [
      createLogoBlock(seed),
      { id: createId(), type: "heading", text: "Packing list", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
      { id: createId(), type: "text", text: "Friday · two nights", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
      { id: createId(), type: "divider", style: "dashed" },
      { id: createId(), type: "checklist", items: [
        { id: createId(), text: "Charger", checked: false },
        { id: createId(), text: "Toothbrush", checked: false },
        { id: createId(), text: "Book", checked: true },
      ] },
      { id: createId(), type: "divider", style: "solid" },
    ],
  });
}

export const receiptTemplates: ReceiptTemplate[] = [
  { id: "blank", revision: 4, name: "Blank receipt", description: "Your mark, today, and a short list to start from.", create: blankReceipt },
  { id: "checklist", revision: 3, name: "Checklist", description: "A compact list with a deliberate finish for packing, groceries, or errands.", create: checklistReceipt },
];

export function createDefaultDocument(seed?: DocumentSeed) {
  return blankReceipt(seed);
}

export function createFromTemplate(templateId: string, seed?: DocumentSeed) {
  const template = receiptTemplates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Template ${templateId} was not found.`);
  return { template, document: template.create(seed) };
}

/**
 * One list a gallery can render without caring whether an entry is a built-in or a
 * person's own saved template: every entry has an id, a name, a description, and a
 * `create(seed)` that produces a document. A user template's `create` ignores the
 * seed and returns the document exactly as it was stored — the sign is already
 * baked into it, unlike a built-in which stamps the seed's sign in on demand.
 *
 * The two kinds are NOT identical once you look past rendering: only "builtin"
 * carries a `revision`, and that is deliberate, not an oversight. `revision` is what
 * `replaceReceiptFromTemplate` (see receipt/controller.ts) uses to stamp a receipt's
 * `source`, and a trusted `source.id` is what lets an agent print without asking a
 * human (see state/permissions.ts). A saved user template must never be able to
 * mint that trust anchor for itself, so its entry has no `revision` field at all —
 * TypeScript refuses to compile a call that reaches for `.revision` on a "user"
 * entry without first narrowing `kind`, which makes stamping `source` on a user
 * template a type error, not just a documented rule.
 */
export type TemplateEntry =
  | { kind: "builtin"; id: string; revision: number; name: string; description: string; create: (seed?: DocumentSeed) => ReceiptDocumentV2 }
  | { kind: "user"; id: string; name: string; description: string; create: (seed?: DocumentSeed) => ReceiptDocumentV2 };

export function listTemplateEntries(store: Pick<DraftStore, "templates">): TemplateEntry[] {
  const builtins: TemplateEntry[] = receiptTemplates.map((template) => ({
    kind: "builtin",
    id: template.id,
    revision: template.revision,
    name: template.name,
    description: template.description,
    create: template.create,
  }));
  const userTemplates: TemplateEntry[] = store.templates.map((stored) => ({
    kind: "user",
    id: stored.id,
    name: stored.name,
    description: "Saved from one of your own receipts.",
    create: () => stored.document,
  }));
  return [...builtins, ...userTemplates];
}

/**
 * The unified counterpart to `createFromTemplate` above, covering both built-in and
 * user templates. Deliberately returns `undefined` rather than throwing when
 * `templateId` isn't found — unlike a built-in id (a hardcoded literal, so "missing"
 * means a programming error worth throwing on), a user template is someone's saved
 * data: it can legitimately have been deleted, or aged out past the 20-item cap,
 * between the gallery being rendered and the person picking it. Callers should
 * treat `undefined` as "that template is gone now," not as a bug.
 */
export function createFromTemplateEntry(store: Pick<DraftStore, "templates">, templateId: string, seed?: DocumentSeed): { template: TemplateEntry; document: ReceiptDocumentV2 } | undefined {
  const template = listTemplateEntries(store).find((entry) => entry.id === templateId);
  if (!template) return undefined;
  return { template, document: template.create(seed) };
}

/**
 * Replacing the contents of a receipt does not change whose printer it came out of.
 * Anything that rewrites the whole document runs its blocks through here, so an agent
 * never has to know that the sign at the top exists in order to leave it alone.
 */
export function keepSign(current: ReceiptDocumentV2, blocks: ReceiptDocumentV2["blocks"]): ReceiptDocumentV2["blocks"] {
  if (blocks.some((block) => block.type === "catalog" && block.kind === "logo")) return blocks;
  const sign = current.blocks.find((block) => block.type === "catalog" && block.kind === "logo");
  return sign ? [sign, ...blocks] : blocks;
}

export function createReminderDocument(current: ReceiptDocumentV2, reminder: ReminderDraft) {
  const blocks: ReceiptDocumentV2["blocks"] = [
    { id: createId(), type: "heading", text: reminder.title, level: "display", weight: "bold", italic: false, underline: false, align: "left" },
  ];
  if (reminder.when) blocks.push({ id: createId(), type: "text", text: reminder.when, size: "small", weight: "medium", italic: false, underline: false, align: "left" });
  blocks.push(
    { id: createId(), type: "divider", style: "dashed" },
    { id: createId(), type: "text", text: reminder.message, size: "large", weight: "regular", italic: false, underline: false, align: "left" },
  );
  if (reminder.checklist?.length) {
    blocks.push({ id: createId(), type: "checklist", items: reminder.checklist.map((text) => ({ id: createId(), text, checked: false })) });
  }
  blocks.push({ id: createId(), type: "divider", style: "solid" });
  return receiptDocumentSchema.parse({ ...current, title: reminder.title, blocks: keepSign(current, blocks) });
}
