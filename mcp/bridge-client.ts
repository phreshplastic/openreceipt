import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { signFontBytes } from "../src/blocks/wordmarks";
import type { AgentAppStatus, AgentBackend } from "../src/agent";
import type { PrintResult } from "../src/printing/coordinator";
import { createReceiptState, type ReceiptState } from "../src/receipt/controller";
import { receiptDocumentSchema, type ReceiptDocument } from "../src/receipt/model";
import { createDefaultDocument } from "../src/receipt/templates";
import { renderReceiptSvg } from "../src/receipt/render";

export type BridgeOptions = {
  baseUrl?: string;
  token?: string;
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
type PrintJobResponse = { id: string; status: string; checksum?: string; error?: string; receiptRevision?: number };

/**
 * An `AgentBackend` backed by the local bridge's HTTP API, so the headless MCP server
 * drives exactly the same receipt the browser is showing. The bridge owns the document;
 * this client is just another optimistic writer, and the open tab picks the change up
 * over its existing SSE subscription.
 */
/**
 * resvg ignores the @font-face the SVG carries for the browser, and this version reads
 * fonts only from disk — so the sign face is laid down once beside the process. Same
 * bytes as the browser embeds, so both paths print the same marks.
 */
let signFontFile: string | undefined;
function signFontPath() {
  if (signFontFile) return signFontFile;
  const bytes = Buffer.from(signFontBytes());
  const file = join(tmpdir(), `petes-printer-sign-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.ttf`);
  if (!existsSync(file)) writeFileSync(file, bytes, { mode: 0o644 });
  signFontFile = file;
  return file;
}

export class BridgeBackend implements AgentBackend {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly approvalPollMs: number;
  private readonly approvalWaitMs: number;
  private lastPrint?: { status: string; message: string };

  constructor(options: BridgeOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.PETES_PRINTER_URL ?? "http://127.0.0.1:8731").replace(/\/$/, "");
    this.token = options.token ?? process.env.PETES_PRINTER_TOKEN;
    this.approvalPollMs = options.approvalPollMs ?? 750;
    this.approvalWaitMs = options.approvalWaitMs ?? 25_000;
  }

  get editorUrl() {
    return `${this.baseUrl}/app`;
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
      const response = await this.request("/api/v1/receipt", {}, signal);
      const body = await response.json() as ReceiptResponse;
      return createReceiptState(receiptDocumentSchema.parse(body.document) as ReceiptDocument, body.revision, body.source as ReceiptState["source"]);
    } catch (error) {
      // A bridge that has never been opened in a browser has no receipt yet; start one.
      if (error instanceof BridgeError && error.code === "receipt_not_initialized") return createReceiptState(createDefaultDocument(), 0);
      throw error;
    }
  }

  async commit(expectedRevision: number, document: ReceiptDocument, summary: string, signal?: AbortSignal): Promise<ReceiptState> {
    const response = await this.request("/api/v1/receipt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mutationId: crypto.randomUUID(),
        expectedRevision,
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
    let bridgeOnline = false;
    let configured = false;
    try {
      const response = await this.request("/api/v1/capabilities", {}, signal);
      const body = await response.json() as { connected?: boolean; configuredProfileId?: string | null };
      bridgeOnline = Boolean(body.connected);
      configured = Boolean(body.configuredProfileId);
    } catch { /* reported as offline below */ }
    return {
      editorUrl: this.editorUrl,
      configured,
      bridgeOnline,
      // Settings are deliberately browser-session-only, so a token client cannot read the
      // policy. Report the conservative case: assume a human tap may be required.
      printPolicy: "confirm",
      syncStatus: bridgeOnline ? "bridge reachable" : "bridge unreachable",
      lastPrint: this.lastPrint,
    };
  }

  async requestPrint(expectedRevision: number, reason: string | undefined, signal?: AbortSignal): Promise<PrintResult> {
    const state = await this.getState(signal);
    if (state.revision !== expectedRevision) {
      return { status: "stale", revision: expectedRevision, message: `Receipt revision ${expectedRevision} is stale; it is now at ${state.revision}.` };
    }

    const rendered = renderReceiptSvg(state.document);
    const png = new Resvg(rendered.svg, {
      fitTo: { mode: "width", value: rendered.width },
      font: { loadSystemFonts: true, fontFiles: [signFontPath()] },
    }).render().asPng();
    const checksum = createHash("sha256").update(png).digest("hex");

    const form = new FormData();
    form.set("metadata", JSON.stringify({
      id: crypto.randomUUID(),
      mutationId: crypto.randomUUID(),
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
      this.lastPrint = { status: "failed", message };
      return { status: "failed", revision: expectedRevision, message };
    }

    return this.toPrintResult(await this.waitForJob(job, signal), expectedRevision, checksum);
  }

  private async waitForJob(job: PrintJobResponse, signal?: AbortSignal): Promise<PrintJobResponse> {
    const terminal = new Set(["succeeded", "failed", "unknown", "rejected", "stale"]);
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
