import type { ReceiptBlock, ReceiptDocument } from "../receipt/model";
import type { DraftBlock } from "./schema";

export type AgentPhase = "reading" | "drafting" | "editing" | "waitingForApproval" | "printing" | "complete" | "error";

const CAPTION_LIMIT = 42;

function clip(value: string, max = CAPTION_LIMIT): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Chrome copy: verb + object, no wrapping quotes, no trailing period. */
export function polishCaption(value: string): string {
  const stripped = value
    .trim()
    .replace(/^the agent\s+/i, "")
    .replace(/[“”"']/g, "")
    .replace(/[.]+$/g, "")
    .replace(/\s+/g, " ");
  if (!stripped) return "Updated the receipt";
  return clip(stripped.charAt(0).toUpperCase() + stripped.slice(1));
}

export function captionForDraft(title: string): string {
  return polishCaption(`Drafted ${clip(title, 28)}`);
}

export function captionForRename(title: string): string {
  return polishCaption(`Named ${clip(title, 28)}`);
}

export function captionForTemplate(name: string, updated = false, action: "save" | "load" = "save"): string {
  if (action === "load") return polishCaption(`Loaded ${clip(name, 28)}`);
  return polishCaption(`${updated ? "Updated" : "Saved"} ${clip(name, 24)}`);
}

export function captionForAddedBlock(block: DraftBlock): string {
  switch (block.type) {
    case "weather": return polishCaption(`Added ${clip(block.city, 20)} weather`);
    case "air": return polishCaption(`Added ${clip(block.city, 20)} air`);
    case "surf": return polishCaption(`Added ${clip(block.city, 20)} surf`);
    case "heading":
    case "text": return polishCaption(`Added ${clip(block.text, 24)}`);
    case "list": return "Added a list";
    case "groups": return polishCaption(`Added ${clip(block.title, 24)}`);
    case "countdown": return polishCaption(`Added ${clip(block.event, 24)}`);
    case "facts": return "Added facts";
    case "table": return "Added a table";
    case "rule": return "Added a rule";
    case "news": return "Added news";
    case "markets": return "Added markets";
    case "games": return "Added games";
    case "quakes": return "Added quakes";
    case "agenda": return "Added an agenda";
    case "habits": return "Added habits";
    case "form": return "Added a form";
    case "logo": return polishCaption(`Added ${clip(block.name, 20)}`);
  }
}

export type CaptionOperation = {
  op: string;
  title?: string;
  text?: string;
  item?: number | string;
  checked?: boolean;
  block?: DraftBlock;
};

export function captionForOperation(operation: CaptionOperation): string {
  switch (operation.op) {
    case "setTitle": return captionForRename(operation.title ?? "the receipt");
    case "add": return operation.block ? captionForAddedBlock(operation.block) : "Added a block";
    case "replace": return operation.block
      ? polishCaption(captionForAddedBlock(operation.block).replace(/^Added/, "Replaced with"))
      : "Replaced a block";
    case "remove": return "Removed a block";
    case "move": return "Moved a block";
    case "refresh": return "Refreshed live data";
    case "setCopy": return polishCaption(`Updated ${clip(operation.text ?? "the copy", 24)}`);
    case "addItem": return polishCaption(`Added ${clip(operation.text ?? "a line", 24)}`);
    case "setItem": return operation.text ? polishCaption(`Updated ${clip(operation.text, 24)}`) : "Updated a line";
    case "checkItem": {
      const name = typeof operation.item === "string" ? clip(operation.item, 24) : "a line";
      return polishCaption(operation.checked === false ? `Unchecked ${name}` : `Checked ${name}`);
    }
    case "removeItem": return typeof operation.item === "string"
      ? polishCaption(`Removed ${clip(operation.item, 24)}`)
      : "Removed a line";
    default: return "Updated the receipt";
  }
}

export function captionForOperations(operations: CaptionOperation[]): string {
  if (operations.length === 0) return "Updated the receipt";
  if (operations.length === 1) return captionForOperation(operations[0]);
  return polishCaption(`${captionForOperation(operations[0])} and ${operations.length - 1} more`);
}

export function captionForDraftProgress(block: DraftBlock): string {
  switch (block.type) {
    case "weather": return polishCaption(`Fetching ${clip(block.city, 18)} weather`);
    case "air": return polishCaption(`Fetching ${clip(block.city, 18)} air`);
    case "surf": return polishCaption(`Fetching ${clip(block.city, 18)} surf`);
    case "news": return "Fetching news";
    case "markets": return "Fetching markets";
    case "games": return "Fetching games";
    case "quakes": return "Fetching quakes";
    case "groups": return polishCaption(`Adding ${clip(block.title, 20)}`);
    case "heading":
    case "text": return polishCaption(`Adding ${clip(block.text, 20)}`);
    case "countdown": return polishCaption(`Adding ${clip(block.event, 20)}`);
    case "logo": return polishCaption(`Adding ${clip(block.name, 20)}`);
    default: return "Drafting a receipt";
  }
}

export function captionForPhase(phase: AgentPhase, detail?: string): string {
  switch (phase) {
    case "reading": return "Reading the receipt";
    case "drafting": return detail ?? "Drafting a receipt";
    case "editing": return detail ?? "Editing the receipt";
    case "waitingForApproval": return "Requesting a print";
    case "printing": return "Printing";
    case "complete": return detail ?? "Updated the receipt";
    case "error": return detail ?? "Couldn't apply that";
  }
}

export function captionForPrint(status: string, message?: string): string {
  if (status === "succeeded") return "Printed";
  if (status === "rejected") return "Kept as a draft";
  if (status === "awaiting_approval") return "Requesting a print";
  if (status === "stale") return "Receipt changed, retrying";
  if (status === "busy") return "A print is already in progress";
  if (status === "cancelled") return "Print cancelled";
  return polishCaption(message || "Print didn't finish");
}

export function isAgentWorking(phase: AgentPhase): boolean {
  return phase === "reading" || phase === "drafting" || phase === "editing" || phase === "waitingForApproval" || phase === "printing";
}

export function changedBlockIds(before: ReceiptDocument, after: ReceiptDocument): string[] {
  const previous = new Map(before.blocks.map((block) => [block.id, JSON.stringify(block)]));
  return after.blocks.filter((block) => previous.get(block.id) !== JSON.stringify(block)).map((block) => block.id);
}

export function agentFocusBlockIds(blocks: ReceiptBlock[], changedIds: string[]): string[] {
  if (changedIds.length === 0) return [];
  const content = changedIds.filter((id) => {
    const block = blocks.find((candidate) => candidate.id === id);
    return !(block?.type === "catalog" && block.kind === "logo");
  });
  return content.length ? content : changedIds;
}
