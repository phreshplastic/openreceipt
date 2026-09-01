import { applyReceiptOperations, createReceiptState, StaleReceiptRevisionError, type ReceiptOperation, type ReceiptState } from "../receipt";
import { createCatalogBlock, reconfigureCatalogBlock, refreshCatalogBlock, type CatalogDependencies, type CatalogInsertConfig } from "./registry";
import type { CatalogBlockKind } from "../receipt/model";

export type CatalogReceiptCommand =
  | { type: "insertCatalogBlock"; kind: CatalogBlockKind; config?: CatalogInsertConfig; index?: number }
  | { type: "refreshCatalogBlock"; id: string }
  | { type: "reconfigureCatalogBlock"; id: string; config: CatalogInsertConfig };

export type ReceiptCommand = ReceiptOperation | CatalogReceiptCommand;

export async function prepareReceiptCommands(state: ReceiptState, expectedRevision: number, commands: ReceiptCommand[], dependencies?: CatalogDependencies) {
  if (state.revision !== expectedRevision) throw new StaleReceiptRevisionError(expectedRevision, state.revision);
  let working = createReceiptState(structuredClone(state.document), 0, state.source);

  for (const command of commands) {
    let operation: ReceiptOperation;
    if (command.type === "insertCatalogBlock") {
      operation = { type: "add", block: await createCatalogBlock(command.kind, command.config, dependencies), index: command.index };
    } else if (command.type === "refreshCatalogBlock") {
      const block = working.document.blocks.find((candidate) => candidate.id === command.id);
      if (!block || block.type !== "catalog") throw new Error(`Catalog block ${command.id} was not found.`);
      operation = { type: "replace", id: block.id, block: await refreshCatalogBlock(block, dependencies) };
    } else if (command.type === "reconfigureCatalogBlock") {
      const block = working.document.blocks.find((candidate) => candidate.id === command.id);
      if (!block || block.type !== "catalog") throw new Error(`Catalog block ${command.id} was not found.`);
      // Throwing here abandons the whole batch, so a failed fetch leaves the receipt untouched.
      operation = { type: "replace", id: block.id, block: await reconfigureCatalogBlock(block, command.config, dependencies) };
    } else operation = command;
    working = applyReceiptOperations(working, working.revision, [operation]);
  }

  return working.document;
}
