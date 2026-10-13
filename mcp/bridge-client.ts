import type { renderCanonical } from "./render";
import type { AgentAppStatus, AgentBackend } from "../src/agent";
import type { PrintResult } from "../src/printing/coordinator";
import { createReceiptState, type ReceiptState } from "../src/receipt/controller";
import { receiptDocumentSchema, type ReceiptDocument } from "../src/receipt/model";
import { createDefaultDocument } from "../src/receipt/templates";
import { receiptTemplates, type ReceiptTemplate } from "../src/receipt/templates";
import type { ReceiptTemplateInfo } from "../src/state/shelf";

export type BridgeOptions = {
  baseUrl?: string;
  token?: string;
  receiptId?: string;
  requestId?: string;
  createIfMissing?: boolean;
  /** Poll interval while a print request waits for a human to approve it in the browser. */
  approvalPollMs?: number;
  /**
   * How long to hold the tool call open before handing back an awaiting_approval result.
   * Hosts time requests out around a minute, so never block on a human for longer than
   * this — report the job id instead and let the agent follow up.
   */
  approvalWaitMs?: number;
};

class BridgeError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly current?: number) {
    super(message);
    this.name = "BridgeError";
  }
}

type ReceiptResponse = { document: unknown; revision: number; source?: { kind: string; id: string; revision: number } };
type PrintJobResponse = { id: string; status: string; checksum?: string; error?: string; receiptRevision?: number; receiptId?: string; reason?: string };

/**
 * An `AgentBackend` backed by the local bridge's HTTP API, so the headless MCP server
 * drives exactly the same receipt the browser is showing. The bridge owns the document;
 * this client is just another optimistic writer, and the open tab picks the change up
 * over its existing SSE subscription.
 */
export class BridgeBackend implements AgentBackend {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly approvalPollMs: number;
  private readonly approvalWaitMs: number;
  private uninitialized = false;
  private expectedActiveId?: string;
  private readonly options: BridgeOptions;
  private lastPrint?: { status: string; message: string };

  constructor(options: BridgeOptions = {}) {
    this.options = options;
    this.baseUrl = (options.baseUrl ?? process.env.PETES_PRINTER_URL ?? "http://127.0.0.1:8731").replace(/\/$/, "");
    this.token = options.token ?? process.env.PETES_PRINTER_TOKEN;
    this.approvalPollMs = options.approvalPollMs ?? 750;
    this.approvalWaitMs = options.approvalWaitMs ?? 25_000;
  }

  get editorUrl() {
    return `${process.env.PETES_PRINTER_EDITOR_URL ?? this.baseUrl}/app${this.options.receiptId ? `?receiptId=${this.options.receiptId}` : ""}`;
  }

  forReceipt(receiptId?: string, requestId?: string, createIfMissing = false) {
    return new BridgeBackend({ ...this.options, baseUrl: this.baseUrl, token: this.token, receiptId, requestId, createIfMissing });
  }

  forToken(token: string) {
    return new BridgeBackend({ ...this.options, baseUrl: this.baseUrl, token });
  }

  private get receiptPath() {
    return this.options.receiptId ? `/api/v1/receipts/${this.options.receiptId}` : "/api/v1/receipt";
  }

  async listReceipts() {
    return (await this.request("/api/v1/receipts")).json() as Promise<{ items: { document: ReceiptDocument; revision: number; updatedAt: string }[] }>;
  }

  async listTemplates(): Promise<ReceiptTemplateInfo[]> {
    const saved = await (await this.request("/api/v1/templates")).json() as { items: ReceiptTemplateInfo[] };
    return [...receiptTemplates.map((template) => ({ id: template.id, name: template.name, kind: "builtin" as const })), ...saved.items];
  }

  async saveTemplate(name: string, document: ReceiptDocument) {
    return (await this.request("/api/v1/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, document }) })).json() as Promise<ReceiptTemplateInfo & { updated: boolean }>;
  }

  async resolveTemplate(idOrName: string) {
    const builtin: ReceiptTemplate | undefined = receiptTemplates.find((template) => template.id === idOrName || template.name.toLowerCase() === idOrName.toLowerCase());
    if (builtin) return { id: builtin.id, name: builtin.name, kind: "builtin" as const, document: builtin.create() };
    const saved = await (await this.request("/api/v1/templates")).json() as { items: (ReceiptTemplateInfo & { document: ReceiptDocument })[] };
    return saved.items.find((template) => template.id === idOrName || template.name.toLowerCase() === idOrName.toLowerCase());
  }

  async preview(signal?: AbortSignal) {
    return this.render((await this.getState(signal)).document, signal);
  }

  private async render(document: ReceiptDocument, signal?: AbortSignal) {
    return (await this.request("/api/v1/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document }) }, signal)).json() as Promise<ReturnType<typeof renderCanonical>>;
  }

  private async request(path: string, init: RequestInit = {}, signal?: AbortSignal) {
    const headers = new Headers(init.headers);
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: signal ?? init.signal });
    if (response.ok) return response;
    let code = `http_${response.status}`;
    let message = `${init.method ?? "GET"} ${path} failed with ${response.status}.`;
    let current: number | undefined;
    try {
      const body = await response.json() as { error?: { code?: string; message?: string; current?: number } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      current = body.error?.current;
    } catch { /* the bridge always sends JSON errors, but never trust it enough to throw here */ }
    if (response.status === 401 || response.status === 403) {
      message = `${message} Create a token with: petes-printer --create-token mcp --scope receipt:read --scope receipt:write --scope print:request --scope print:status, then set PETES_PRINTER_TOKEN.`;
    }
    throw new BridgeError(response.status, code, message, current);
  }

  async getState(signal?: AbortSignal): Promise<ReceiptState> {
    try {
      const response = await this.request(this.receiptPath, {}, signal);
      const body = await response.json() as ReceiptResponse;
      this.expectedActiveId = (body.document as ReceiptDocument).id;
      return createReceiptState(receiptDocumentSchema.parse(body.document) as ReceiptDocument, body.revision, body.source as ReceiptState["source"]);
    } catch (error) {
      // A bridge that has never been opened in a browser has no receipt yet; start one.
      if (error instanceof BridgeError && (error.code === "receipt_not_initialized" || (error.code === "receipt_not_found" && this.options.createIfMissing))) {
        this.uninitialized = true;
        const document = createDefaultDocument();
        if (this.options.receiptId) document.id = this.options.receiptId;
        return createReceiptState(document, 0);
      }
      throw error;
    }
  }

  async commit(expectedRevision: number, document: ReceiptDocument, summary: string, signal?: AbortSignal): Promise<ReceiptState> {
    const response = await this.request(this.receiptPath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mutationId: crypto.randomUUID(),
        expectedRevision: this.uninitialized ? null : expectedRevision,
        expectedReceiptId: this.expectedActiveId,
        proposedRevision: expectedRevision + 1,
        document,
        actor: { kind: "mcp", label: "MCP client" },
        summary,
      }),
    }, signal);
    const body = await response.json() as ReceiptResponse;
    return createReceiptState(receiptDocumentSchema.parse(body.document) as ReceiptDocument, body.revision);
  }

  async status(signal?: AbortSignal): Promise<AgentAppStatus> {
    const response = await this.request("/api/v1/status", {}, signal);
    const state = await response.json() as { configured: boolean; bridgeOnline: boolean; printerConnected: boolean; printerReady: boolean; queuePaused: boolean; printPolicy: "confirm" | "approved" | "autonomous" };
    return { ...state, editorUrl: this.editorUrl, syncStatus: "bridge reachable", lastPrint: this.lastPrint };
  }

  async replayPrint(expectedRevision: number, reason: string | undefined, signal?: AbortSignal): Promise<PrintResult | undefined> {
    if (this.options.requestId) {
      try {
        const existing = await (await this.request(`/api/v1/print-requests/${this.options.requestId}`, {}, signal)).json() as PrintJobResponse;
        const receiptId = this.options.receiptId ?? (await this.getState(signal)).document.id;
        if (existing.receiptId !== receiptId || existing.receiptRevision !== expectedRevision || (existing.reason ?? "") !== (reason ?? "")) {
          return { status: "failed", jobId: existing.id, revision: expectedRevision, message: "This request ID belongs to a different print request. Check its status before making a new request." };
        }
        return this.toPrintResult(await this.waitForJob(existing, signal), expectedRevision, existing.checksum ?? "");
      } catch (error) {
        if (!(error instanceof BridgeError) || error.status !== 404) throw error;
      }
    }
    return undefined;
  }

  async requestPrint(expectedRevision: number, reason: string | undefined, signal?: AbortSignal): Promise<PrintResult> {
    const replay = await this.replayPrint(expectedRevision, reason, signal);
    if (replay) return replay;
    const state = await this.getState(signal);
    if (state.revision !== expectedRevision) {
      return { status: "stale", revision: expectedRevision, message: `Receipt revision ${expectedRevision} is stale; it is now at ${state.revision}.` };
    }

    const rendered = await this.render(state.document, signal);
    const png = Buffer.from(rendered.png, "base64");
    const checksum = rendered.checksum;
    const jobId = this.options.requestId ?? crypto.randomUUID();

    const form = new FormData();
    form.set("metadata", JSON.stringify({
      id: jobId,
      mutationId: jobId,
      receiptId: state.document.id,
      checksum,
      rendererVersion: rendered.rendererVersion,
      expectedRevision,
      requester: { kind: "mcp", label: "MCP client" },
      reason,
      width: rendered.width,
      height: rendered.height,
      feedLines: 4,
      cutMode: "full",
    }));
    form.set("artifact", new Blob([new Uint8Array(png)], { type: "image/png" }), "receipt.png");

    let job: PrintJobResponse;
    try {
      job = await (await this.request("/api/v1/print-requests", { method: "POST", body: form }, signal)).json() as PrintJobResponse;
    } catch (error) {
      if (error instanceof BridgeError && error.code === "stale_revision") {
        return { status: "stale", revision: expectedRevision, message: error.message };
      }
      const message = error instanceof Error ? error.message : "The print request failed.";
      const status = error instanceof BridgeError ? "failed" : "unknown";
      const detail = status === "unknown" ? `The bridge response was lost. Check job ${jobId} before retrying; the request may have been accepted.` : message;
      this.lastPrint = { status, message: detail };
      return { status, jobId, revision: expectedRevision, message: detail };
    }

    return this.toPrintResult(await this.waitForJob(job, signal), expectedRevision, checksum);
  }

  private async waitForJob(job: PrintJobResponse, signal?: AbortSignal): Promise<PrintJobResponse> {
    const terminal = new Set(["succeeded", "failed", "unknown", "rejected", "stale", "cancelled", "waiting_for_printer"]);
    const deadline = Date.now() + this.approvalWaitMs;
    let current = job;
    while (!terminal.has(current.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, this.approvalPollMs));
      if (signal?.aborted) return current;
      current = await (await this.request(`/api/v1/print-requests/${current.id}`, {}, signal)).json() as PrintJobResponse;
    }
    return current;
  }

  private toPrintResult(job: PrintJobResponse, revision: number, checksum: string): PrintResult {
    const base = { revision, checksum, jobId: job.id };
    const result: PrintResult = job.status === "succeeded" ? { ...base, status: "succeeded", message: "The receipt printed." }
      : job.status === "rejected" ? { ...base, status: "rejected", message: "The person declined the print in the browser." }
      : job.status === "stale" ? { ...base, status: "stale", message: "The receipt changed while the print was waiting for approval." }
      : job.status === "failed" ? { ...base, status: "failed", message: job.error || "The printer reported a failure." }
      : job.status === "unknown" ? { ...base, status: "unknown", message: "The printer stopped responding mid-job — check the paper before retrying." }
      : job.status === "cancelled" ? { ...base, status: "cancelled", message: "The print was cancelled." }
      : ["queued", "waiting_for_printer", "sending"].includes(job.status) ? { ...base, status: job.status as "queued" | "waiting_for_printer" | "sending", message: `Job ${job.id} is ${job.status}. Check its status; do not resubmit.` }
      // Still queued or awaiting a tap. Hand the job back rather than holding the call
      // open past the host's request timeout.
      : { ...base, status: "awaiting_approval", message: `Waiting for approval at ${this.editorUrl}. Ask them to tap “Approve and print”, then check job ${job.id} with get_print_job_status.` };
    this.lastPrint = { status: result.status, message: result.message };
    return result;
  }

  /** Terminal state of a job the agent submitted earlier, for "did it print?". */
  async getPrintJob(jobId: string, signal?: AbortSignal): Promise<PrintJobResponse> {
    return (await this.request(`/api/v1/print-requests/${jobId}`, {}, signal)).json() as Promise<PrintJobResponse>;
  }
}
