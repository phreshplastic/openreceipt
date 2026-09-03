/**
 * Human-facing summaries of the WebMCP tools. Names, titles, and read/write flags
 * must stay in step with `createAgentTools` — `tool-catalog.test.ts` checks that.
 */
export type WebMcpToolSummary = {
  name: string;
  title: string;
  copy: string;
  readOnly: boolean;
};

export const webMcpToolCatalog: WebMcpToolSummary[] = [
  { name: "get_app_status", title: "Check OpenReceipt", copy: "Whether the editor and printer are ready.", readOnly: true },
  { name: "get_receipt", title: "Read the receipt", copy: "What's on the paper right now.", readOnly: true },
  { name: "list_receipt_blocks", title: "List block types", copy: "The vocabulary that can go on a receipt.", readOnly: true },
  { name: "list_receipt_recipes", title: "List situations", copy: "Which blocks belong for a trip, a morning, a shop.", readOnly: true },
  { name: "list_receipt_templates", title: "List templates", copy: "Built-in starters and any you have saved from a receipt.", readOnly: true },
  { name: "draft_receipt", title: "Draft a receipt", copy: "Start from a situation, not a blank page.", readOnly: false },
  { name: "edit_receipt", title: "Edit the receipt", copy: "Change a heading or one line without rewriting the rest.", readOnly: false },
  { name: "rename_receipt", title: "Name the receipt", copy: "The name on the drafts shelf, not the heading on the paper.", readOnly: false },
  { name: "save_receipt_template", title: "Save as a template", copy: "Keep this receipt as a named starting point.", readOnly: false },
  { name: "load_receipt_template", title: "Load a template", copy: "Replace the current receipt with a saved or built-in one.", readOnly: false },
  { name: "preview_receipt", title: "Preview the print", copy: "Read back exactly what will print.", readOnly: true },
  { name: "undo_agent_edit", title: "Undo the last change", copy: "Step the paper back to the previous version.", readOnly: false },
  { name: "request_receipt_print", title: "Request a print", copy: "Always waits for your approval.", readOnly: false },
  { name: "open_receipt_editor", title: "Open the editor", copy: "Bring the person to the visible draft.", readOnly: false },
];

export const webMcpReadToolCount = webMcpToolCatalog.filter((tool) => tool.readOnly).length;
export const webMcpWriteToolCount = webMcpToolCatalog.length - webMcpReadToolCount;
