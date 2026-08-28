import { createId, receiptDocumentSchema, type ReceiptDocumentV1 } from "./model";

export type ReceiptTemplate = {
  id: string;
  revision: number;
  name: string;
  description: string;
  create: () => ReceiptDocumentV1;
};

const page = { paperWidthMm: 80 as const, printableWidthDots: 576 as const, paddingDots: 28 };

function blankReceipt(): ReceiptDocumentV1 {
  return receiptDocumentSchema.parse({
    schemaVersion: 1,
    id: createId(),
    title: "Untitled receipt",
    page,
    blocks: [
      { id: createId(), type: "heading", text: "A small thing, clearly said.", level: "display", align: "left" },
      { id: createId(), type: "text", text: "Click any text on the receipt to edit it.", size: "body", weight: "regular", align: "left" },
    ],
  });
}

function checklistReceipt(): ReceiptDocumentV1 {
  return receiptDocumentSchema.parse({
    schemaVersion: 1,
    id: createId(),
    title: "Packing list",
    page,
    blocks: [
      { id: createId(), type: "heading", text: "PACKING LIST", level: "display", align: "left" },
      { id: createId(), type: "text", text: "Friday · two nights", size: "small", weight: "medium", align: "left" },
      { id: createId(), type: "divider", style: "dashed" },
      { id: createId(), type: "checklist", items: [
        { id: createId(), text: "Charger", checked: false },
        { id: createId(), text: "Toothbrush", checked: false },
        { id: createId(), text: "Book", checked: true },
      ] },
    ],
  });
}

export const receiptTemplates: ReceiptTemplate[] = [
  { id: "blank", revision: 1, name: "Blank receipt", description: "A heading and a clean place to begin.", create: blankReceipt },
  { id: "checklist", revision: 1, name: "Checklist", description: "A compact list for packing, groceries, or errands.", create: checklistReceipt },
];

export function createDefaultDocument() {
  return blankReceipt();
}

export function createFromTemplate(templateId: string) {
  const template = receiptTemplates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Template ${templateId} was not found.`);
  return { template, document: template.create() };
}
