import { z } from "zod";

const id = z.string().uuid();
const align = z.enum(["left", "center", "right"]);
const weight = z.enum(["regular", "medium", "bold"]);

const headingBlockSchema = z.object({
  id,
  type: z.literal("heading"),
  text: z.string().max(240),
  level: z.enum(["display", "heading", "section"]).default("heading"),
  weight: weight.default("bold"),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  align: align.default("left"),
});

const textBlockSchema = z.object({
  id,
  type: z.literal("text"),
  text: z.string().max(4_000),
  size: z.enum(["small", "body", "large"]).default("body"),
  weight: weight.default("regular"),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
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

export const coreReceiptBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  checklistBlockSchema,
  keyValueBlockSchema,
  tableBlockSchema,
  dividerBlockSchema,
]);

const weatherDataSchema = z.object({
  condition: z.string().max(120),
  summary: z.string().max(500),
  points: z.array(z.object({ label: z.string().max(40), temperature: z.number(), condition: z.string().max(120) })).length(3),
  precipitation: z.number(),
  uv: z.number(),
  sunset: z.string().max(40),
  updated: z.string().max(40),
  temperatureTrend: z.array(z.number()).min(3).max(24),
  precipitationTrend: z.array(z.number()).min(3).max(24),
});

const locationSchema = z.object({
  name: z.string().min(1).max(160),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1).max(100),
});

const weatherCatalogBlockSchema = z.object({
  id,
  type: z.literal("catalog"),
  kind: z.literal("weather"),
  definitionVersion: z.literal(1),
  config: z.object({ location: locationSchema, unit: z.enum(["fahrenheit", "celsius"]) }),
  data: weatherDataSchema,
  refreshedAt: z.string().datetime(),
  stale: z.boolean().default(false),
  refreshError: z.string().max(300).optional(),
});

const agendaEventSchema = z.object({
  id,
  start: z.string().max(40),
  end: z.string().max(40).optional(),
  title: z.string().max(300),
  detail: z.string().max(300).optional(),
});

const agendaCatalogBlockSchema = z.object({
  id,
  type: z.literal("catalog"),
  kind: z.literal("agenda"),
  definitionVersion: z.literal(1),
  data: z.object({ date: z.string().max(100), events: z.array(agendaEventSchema).max(16) }),
});

const habitRowSchema = z.object({
  id,
  label: z.string().max(80),
  values: z.array(z.union([z.literal(0), z.literal(1), z.literal(2)])).length(7),
});

const habitCatalogBlockSchema = z.object({
  id,
  type: z.literal("catalog"),
  kind: z.literal("habit"),
  definitionVersion: z.literal(1),
  data: z.object({ title: z.string().max(120), period: z.string().max(120), rows: z.array(habitRowSchema).min(1).max(10) }),
});

const dailyPlanCatalogBlockSchema = z.object({
  id,
  type: z.literal("catalog"),
  kind: z.literal("dailyPlan"),
  definitionVersion: z.literal(1),
  data: z.object({
    dateLabel: z.string().max(120),
    title: z.string().max(120),
    prioritiesLabel: z.string().max(80),
    scheduleLabel: z.string().max(80),
    rememberLabel: z.string().max(80),
  }),
});

export const catalogReceiptBlockSchema = z.discriminatedUnion("kind", [
  weatherCatalogBlockSchema,
  agendaCatalogBlockSchema,
  habitCatalogBlockSchema,
  dailyPlanCatalogBlockSchema,
]);

export const receiptBlockSchema = z.union([coreReceiptBlockSchema, catalogReceiptBlockSchema]);

const pageSchema = z.object({
  paperWidthMm: z.union([z.literal(80), z.literal(58)]),
  printableWidthDots: z.union([z.literal(576), z.literal(420)]),
  paddingDots: z.number().int().min(0).max(80),
}).superRefine((page, context) => {
  if ((page.paperWidthMm === 80) !== (page.printableWidthDots === 576)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Paper width and printable dots must use a supported profile." });
  }
});

export const receiptDocumentV1Schema = z.object({
  schemaVersion: z.literal(1),
  id,
  title: z.string().min(1).max(160),
  page: pageSchema,
  blocks: z.array(coreReceiptBlockSchema).min(1).max(100),
});

export const receiptDocumentV2Schema = z.object({
  schemaVersion: z.literal(2),
  id,
  title: z.string().min(1).max(160),
  page: pageSchema,
  blocks: z.array(receiptBlockSchema).min(1).max(100),
});

export const receiptDocumentSchema = z.union([
  receiptDocumentV2Schema,
  receiptDocumentV1Schema.transform((document) => ({ ...document, schemaVersion: 2 as const })),
]);

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

export type ReceiptDocumentV1 = z.infer<typeof receiptDocumentV1Schema>;
export type ReceiptDocumentV2 = z.infer<typeof receiptDocumentV2Schema>;
export type ReceiptDocument = ReceiptDocumentV2;
export type ReceiptBlock = z.infer<typeof receiptBlockSchema>;
export type CoreReceiptBlock = z.infer<typeof coreReceiptBlockSchema>;
export type CatalogReceiptBlock = z.infer<typeof catalogReceiptBlockSchema>;
export type CatalogBlockKind = CatalogReceiptBlock["kind"];
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

export function createBlock(type: CoreReceiptBlock["type"]): CoreReceiptBlock {
  const blockId = createId();
  switch (type) {
    case "heading": return { id: blockId, type, text: "New heading", level: "heading", weight: "bold", italic: false, underline: false, align: "left" };
    case "text": return { id: blockId, type, text: "Write something useful.", size: "body", weight: "regular", italic: false, underline: false, align: "left" };
    case "checklist": return { id: blockId, type, items: [{ id: createId(), text: "First item", checked: false }] };
    case "keyValue": return { id: blockId, type, rows: [{ id: createId(), label: "Label", value: "Value", emphasis: false }], dividers: false };
    case "table": return { id: blockId, type, columns: 2, rows: [{ id: createId(), cells: ["Item", "Value"] }], header: true };
    case "divider": return { id: blockId, type, style: "solid" };
  }
}
