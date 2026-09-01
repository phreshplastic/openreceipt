import { createId, receiptDocumentSchema, type ReceiptDocumentV2 } from "./model";

export type ReceiptTemplate = {
  id: string;
  revision: number;
  name: string;
  description: string;
  create: () => ReceiptDocumentV2;
};

export type ReminderDraft = {
  title: string;
  message: string;
  when?: string;
  checklist?: string[];
};

const page = { paperWidthMm: 80 as const, printableWidthDots: 576 as const, paddingDots: 28 };

function blankReceipt(): ReceiptDocumentV2 {
  return receiptDocumentSchema.parse({
    schemaVersion: 2,
    id: createId(),
    title: "Untitled receipt",
    page,
    blocks: [
      { id: createId(), type: "heading", text: "A small thing, clearly said.", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
      { id: createId(), type: "text", text: "Click any text on the receipt to edit it.", size: "body", weight: "regular", italic: false, underline: false, align: "left" },
      { id: createId(), type: "divider", style: "dashed" },
      { id: createId(), type: "text", text: "PETE’S PRINTER · MADE TOGETHER", size: "small", weight: "medium", italic: false, underline: false, align: "center" },
    ],
  });
}

function checklistReceipt(): ReceiptDocumentV2 {
  return receiptDocumentSchema.parse({
    schemaVersion: 2,
    id: createId(),
    title: "Packing list",
    page,
    blocks: [
      { id: createId(), type: "heading", text: "PACKING LIST", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
      { id: createId(), type: "text", text: "Friday · two nights", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
      { id: createId(), type: "divider", style: "dashed" },
      { id: createId(), type: "checklist", items: [
        { id: createId(), text: "Charger", checked: false },
        { id: createId(), text: "Toothbrush", checked: false },
        { id: createId(), text: "Book", checked: true },
      ] },
      { id: createId(), type: "divider", style: "solid" },
      { id: createId(), type: "text", text: "PACK LIGHT · GO WELL", size: "small", weight: "medium", italic: false, underline: false, align: "center" },
    ],
  });
}

export const receiptTemplates: ReceiptTemplate[] = [
  { id: "blank", revision: 2, name: "Blank receipt", description: "A heading, a clean place to begin, and a small closing mark.", create: blankReceipt },
  { id: "checklist", revision: 2, name: "Checklist", description: "A compact list with a deliberate finish for packing, groceries, or errands.", create: checklistReceipt },
];

export function createDefaultDocument() {
  return blankReceipt();
}

export function createFromTemplate(templateId: string) {
  const template = receiptTemplates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Template ${templateId} was not found.`);
  return { template, document: template.create() };
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
  blocks.push(
    { id: createId(), type: "divider", style: "solid" },
    { id: createId(), type: "text", text: "REMINDER · MADE TOGETHER", size: "small", weight: "medium", italic: false, underline: false, align: "center" },
  );
  return receiptDocumentSchema.parse({ ...current, title: reminder.title, blocks });
}
