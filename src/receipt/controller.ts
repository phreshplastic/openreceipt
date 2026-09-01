import { receiptDocumentSchema, receiptOperationsSchema, type ReceiptDocumentV1, type ReceiptDocumentV2, type ReceiptOperation } from "./model";

export type ReceiptSource = { kind: "template"; id: string; revision: number };

export type ReceiptState = {
  document: ReceiptDocumentV2;
  revision: number;
  source?: ReceiptSource;
};

type ReceiptSnapshot = Pick<ReceiptState, "document" | "source">;

export type ReceiptHistoryStatus = {
  canUndo: boolean;
  canRedo: boolean;
};

export class StaleReceiptRevisionError extends Error {
  constructor(expected: number, actual: number) {
    super(`Receipt revision ${expected} is stale; current revision is ${actual}.`);
    this.name = "StaleReceiptRevisionError";
  }
}

export function createReceiptState(document: ReceiptDocumentV1 | ReceiptDocumentV2, revision = 0, source?: ReceiptSource): ReceiptState {
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

export function replaceReceiptFromTemplate(state: ReceiptState, document: ReceiptDocumentV2, templateId: string, templateRevision: number): ReceiptState {
  return {
    document: receiptDocumentSchema.parse(document),
    revision: state.revision + 1,
    source: { kind: "template", id: templateId, revision: templateRevision },
  };
}

/**
 * Owns the live receipt and its session history. Undo and redo restore content,
 * but revisions remain monotonic so stale browser-agent mutations stay stale.
 */
export class ReceiptController {
  private current: ReceiptState;
  private past: ReceiptSnapshot[] = [];
  private future: ReceiptSnapshot[] = [];

  constructor(initialState: ReceiptState) {
    this.current = createReceiptState(initialState.document, initialState.revision, initialState.source);
  }

  get state() {
    return this.current;
  }

  get history(): ReceiptHistoryStatus {
    return { canUndo: this.past.length > 0, canRedo: this.future.length > 0 };
  }

  apply(expectedRevision: number, operations: ReceiptOperation[]) {
    const next = applyReceiptOperations(this.current, expectedRevision, operations);
    this.record(next);
    return this.current;
  }

  loadTemplate(expectedRevision: number, document: ReceiptDocumentV2, templateId: string, templateRevision: number) {
    if (expectedRevision !== this.current.revision) throw new StaleReceiptRevisionError(expectedRevision, this.current.revision);
    const next = replaceReceiptFromTemplate(this.current, document, templateId, templateRevision);
    this.record(next);
    return this.current;
  }

  commitPrepared(expectedRevision: number, document: ReceiptDocumentV2) {
    if (expectedRevision !== this.current.revision) throw new StaleReceiptRevisionError(expectedRevision, this.current.revision);
    const next = createReceiptState(document, this.current.revision + 1);
    this.record(next);
    return this.current;
  }

  undo() {
    const snapshot = this.past.pop();
    if (!snapshot) return this.current;
    this.future.push(this.snapshot(this.current));
    this.current = createReceiptState(snapshot.document, this.current.revision + 1, snapshot.source);
    return this.current;
  }

  redo() {
    const snapshot = this.future.pop();
    if (!snapshot) return this.current;
    this.past.push(this.snapshot(this.current));
    this.current = createReceiptState(snapshot.document, this.current.revision + 1, snapshot.source);
    return this.current;
  }

  acceptShared(state: ReceiptState, recordHistory = true) {
    const next = createReceiptState(state.document, state.revision, state.source);
    if (recordHistory && JSON.stringify(this.current.document) !== JSON.stringify(next.document)) {
      this.past.push(this.snapshot(this.current));
      this.future = [];
    }
    this.current = next;
    return this.current;
  }

  private record(next: ReceiptState) {
    this.past.push(this.snapshot(this.current));
    this.future = [];
    this.current = next;
  }

  private snapshot(state: ReceiptState): ReceiptSnapshot {
    return { document: receiptDocumentSchema.parse(state.document), source: state.source };
  }
}
