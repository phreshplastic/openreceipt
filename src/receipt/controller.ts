import { receiptDocumentSchema, receiptOperationsSchema, type ReceiptDocumentV1, type ReceiptOperation } from "./model";

export type ReceiptSource = { kind: "template"; id: string; revision: number };

export type ReceiptState = {
  document: ReceiptDocumentV1;
  revision: number;
  source?: ReceiptSource;
};

export class StaleReceiptRevisionError extends Error {
  constructor(expected: number, actual: number) {
    super(`Receipt revision ${expected} is stale; current revision is ${actual}.`);
    this.name = "StaleReceiptRevisionError";
  }
}

export function createReceiptState(document: ReceiptDocumentV1, revision = 0, source?: ReceiptSource): ReceiptState {
  return { document: receiptDocumentSchema.parse(document), revision, source };
}

export function applyReceiptOperations(state: ReceiptState, expectedRevision: number, input: ReceiptOperation[]): ReceiptState {
  if (state.revision !== expectedRevision) throw new StaleReceiptRevisionError(expectedRevision, state.revision);
  const operations = receiptOperationsSchema.parse(input);
  const blocks = [...state.document.blocks];
  let title = state.document.title;
  let page = state.document.page;

  for (const operation of operations) {
    if (operation.type === "setTitle") title = operation.title;
    if (operation.type === "setPage") page = operation.page;
    if (operation.type === "add") {
      if (blocks.some((block) => block.id === operation.block.id)) throw new Error(`Block ${operation.block.id} already exists.`);
      const index = operation.index ?? blocks.length;
      if (index > blocks.length) throw new Error(`Cannot insert a block at index ${index}.`);
      blocks.splice(index, 0, operation.block);
    }

    if (operation.type === "replace") {
      const index = blocks.findIndex((block) => block.id === operation.id);
      if (index < 0) throw new Error(`Block ${operation.id} was not found.`);
      if (operation.block.id !== operation.id) throw new Error("Replacement blocks must preserve their ID.");
      blocks[index] = operation.block;
    }

    if (operation.type === "remove") {
      const index = blocks.findIndex((block) => block.id === operation.id);
      if (index < 0) throw new Error(`Block ${operation.id} was not found.`);
      blocks.splice(index, 1);
    }

    if (operation.type === "move") {
      const index = blocks.findIndex((block) => block.id === operation.id);
      if (index < 0) throw new Error(`Block ${operation.id} was not found.`);
      if (operation.toIndex >= blocks.length) throw new Error(`Cannot move a block to index ${operation.toIndex}.`);
      const [block] = blocks.splice(index, 1);
      blocks.splice(operation.toIndex, 0, block);
    }
  }

  const document = receiptDocumentSchema.parse({ ...state.document, title, page, blocks });
  return { document, revision: state.revision + 1 };
}

export function replaceReceiptFromTemplate(state: ReceiptState, document: ReceiptDocumentV1, templateId: string, templateRevision: number): ReceiptState {
  return {
    document: receiptDocumentSchema.parse(document),
    revision: state.revision + 1,
    source: { kind: "template", id: templateId, revision: templateRevision },
  };
}
