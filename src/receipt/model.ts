import { z } from "zod";

const id = z.string().uuid();
const align = z.enum(["left", "center", "right"]);

const headingBlockSchema = z.object({
  id,
  type: z.literal("heading"),
  text: z.string().max(240),
  level: z.enum(["display", "heading", "section"]).default("heading"),
  align: align.default("left"),
});

const textBlockSchema = z.object({
  id,
  type: z.literal("text"),
  text: z.string().max(4_000),
  size: z.enum(["small", "body", "large"]).default("body"),
  weight: z.enum(["regular", "medium", "bold"]).default("regular"),
  align: align.default("left"),
});

const checklistItemSchema = z.object({
  id,
  text: z.string().max(500),
  checked: z.boolean().default(false),
});

const checklistBlockSchema = z.object({
  id,
  type: z.literal("checklist"),
  items: z.array(checklistItemSchema).max(40),
});

const keyValueRowSchema = z.object({
  id,
  label: z.string().max(160),
  value: z.string().max(300),
  emphasis: z.boolean().default(false),
});

const keyValueBlockSchema = z.object({
  id,
  type: z.literal("keyValue"),
  rows: z.array(keyValueRowSchema).max(40),
  dividers: z.boolean().default(false),
});

const tableRowSchema = z.object({
  id,
  cells: z.array(z.string().max(300)).min(2).max(3),
});

const tableBlockSchema = z.object({
  id,
  type: z.literal("table"),
  columns: z.union([z.literal(2), z.literal(3)]),
  rows: z.array(tableRowSchema).max(40),
  header: z.boolean().default(false),
});

const dividerBlockSchema = z.object({
  id,
  type: z.literal("divider"),
  style: z.enum(["solid", "dashed"]).default("solid"),
});

export const receiptBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  checklistBlockSchema,
  keyValueBlockSchema,
  tableBlockSchema,
  dividerBlockSchema,
]);

export const receiptDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  title: z.string().min(1).max(160),
  page: z.object({
    paperWidthMm: z.union([z.literal(80), z.literal(58)]),
    printableWidthDots: z.union([z.literal(576), z.literal(420)]),
    paddingDots: z.number().int().min(0).max(80),
  }).superRefine((page, context) => {
    if ((page.paperWidthMm === 80) !== (page.printableWidthDots === 576)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Paper width and printable dots must use a supported profile." });
    }
  }),
  blocks: z.array(receiptBlockSchema).min(1).max(100),
});

export const receiptOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setTitle"), title: z.string().min(1).max(160) }),
  z.object({ type: z.literal("setPage"), page: z.object({
    paperWidthMm: z.union([z.literal(80), z.literal(58)]),
    printableWidthDots: z.union([z.literal(576), z.literal(420)]),
    paddingDots: z.number().int().min(0).max(80),
  }) }),
  z.object({ type: z.literal("add"), block: receiptBlockSchema, index: z.number().int().min(0).optional() }),
  z.object({ type: z.literal("replace"), id, block: receiptBlockSchema }),
  z.object({ type: z.literal("remove"), id }),
  z.object({ type: z.literal("move"), id, toIndex: z.number().int().min(0) }),
]);

export const receiptOperationsSchema = z.array(receiptOperationSchema).min(1).max(100);

export type ReceiptDocumentV1 = z.infer<typeof receiptDocumentSchema>;
export type ReceiptBlock = z.infer<typeof receiptBlockSchema>;
export type ReceiptOperation = z.infer<typeof receiptOperationSchema>;
export type HeadingBlock = Extract<ReceiptBlock, { type: "heading" }>;
export type TextBlock = Extract<ReceiptBlock, { type: "text" }>;
export type ChecklistBlock = Extract<ReceiptBlock, { type: "checklist" }>;
export type KeyValueBlock = Extract<ReceiptBlock, { type: "keyValue" }>;
export type TableBlock = Extract<ReceiptBlock, { type: "table" }>;
export type DividerBlock = Extract<ReceiptBlock, { type: "divider" }>;

export function createId() {
  return crypto.randomUUID();
}

export function createBlock(type: ReceiptBlock["type"]): ReceiptBlock {
  const blockId = createId();
  switch (type) {
    case "heading": return { id: blockId, type, text: "New heading", level: "heading", align: "left" };
    case "text": return { id: blockId, type, text: "Write something useful.", size: "body", weight: "regular", align: "left" };
    case "checklist": return { id: blockId, type, items: [{ id: createId(), text: "First item", checked: false }] };
    case "keyValue": return { id: blockId, type, rows: [{ id: createId(), label: "Label", value: "Value", emphasis: false }], dividers: false };
    case "table": return { id: blockId, type, columns: 2, rows: [{ id: createId(), cells: ["Item", "Value"] }], header: true };
    case "divider": return { id: blockId, type, style: "solid" };
  }
}
