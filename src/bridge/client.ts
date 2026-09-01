import type { ReceiptDocumentV2, RasterizedReceipt, ReceiptState, RenderedReceipt } from "../receipt";
import type { SharedSettings } from "../state/storage";

export type PaperProfile = {
  id: "80mm-576" | "58mm-420";
  label: string;
  paperWidthMm: 80 | 58;
  printableWidthDots: 576 | 420;
  paddingDots: number;
};

export type BridgeCapabilities = {
  connected: boolean;
  adapter: "epson-tm-l90-usb" | "dummy";
  model: string;
  transport: "usb" | "dummy";
  cutModes: ("full" | "partial")[];
  profiles: PaperProfile[];
  configuredProfileId: string;
  detail?: string;
};

export type PrintJobStatus = "awaiting_approval" | "queued" | "sending" | "succeeded" | "failed" | "unknown" | "rejected" | "stale" | "cancelled";

export type PrintJob = {
  id: string;
  status: PrintJobStatus;
  checksum: string;
  error?: string | null;
  receiptRevision?: number | null;
  reason?: string | null;
  requester?: ApiActor | null;
  document?: ReceiptDocumentV2 | null;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiActor = { kind: "human" | "webmcp" | "api" | "mcp" | "system"; label?: string; clientId?: string };
export type CanonicalReceipt = ReceiptState & { checksum: string; createdAt: string; updatedAt: string };
export type CanonicalSettings = { revision: number; initialized: boolean; configured: boolean; printPolicy: "confirm" | "approved" | "autonomous"; trustedTemplateIds: string[]; defaultLocation: string; defaultUnit: "fahrenheit" | "celsius"; updatedAt: string };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public current?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

let sessionPromise: Promise<string> | undefined;

export function ensureBrowserSession() {
  sessionPromise ??= fetch("/api/v1/session", { method: "POST", credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Could not start the local API session (${response.status}).`);
      return (await response.json() as { csrfToken: string }).csrfToken;
    })
    .catch((error) => { sessionPromise = undefined; throw error; });
  return sessionPromise;
}

async function apiFetch(input: string, init: RequestInit = {}, unsafe = false) {
  const csrfToken = await ensureBrowserSession();
  const headers = new Headers(init.headers);
  if (unsafe) headers.set("X-CSRF-Token", csrfToken);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

async function readJson<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const envelope = value as { detail?: string; error?: { code?: string; message?: string; current?: unknown } };
    throw new ApiError(response.status, envelope.error?.code ?? "bridge_error", envelope.error?.message ?? envelope.detail ?? `Bridge request failed (${response.status}).`, envelope.error?.current);
  }
  return value as T;
}

export async function getCapabilities(signal?: AbortSignal) {
  return readJson<BridgeCapabilities>(await fetch("/api/v1/capabilities", { signal, cache: "no-store" }));
}

export async function saveConfiguration(profileId: PaperProfile["id"]) {
  return readJson<BridgeCapabilities>(await apiFetch("/api/v1/configuration", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapter: "epson-tm-l90-usb", profileId }),
  }, true));
}

export async function getCanonicalReceipt(signal?: AbortSignal) {
  return readJson<CanonicalReceipt>(await apiFetch("/api/v1/receipt", { signal, cache: "no-store" }));
}

export async function commitCanonicalReceipt(state: ReceiptState, expectedRevision: number | null, actor: ApiActor, summary?: string, mutationId = crypto.randomUUID(), signal?: AbortSignal) {
  return readJson<CanonicalReceipt>(await apiFetch("/api/v1/receipt", {
    method: "PUT", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mutationId, expectedRevision, proposedRevision: state.revision, document: state.document, source: state.source, actor, summary }),
  }, true));
}

export async function getCanonicalSettings(signal?: AbortSignal) {
  return readJson<CanonicalSettings>(await apiFetch("/api/v1/settings", { signal, cache: "no-store" }));
}

export async function updateCanonicalSettings(settings: SharedSettings, expectedRevision: number, actor: ApiActor, mutationId = crypto.randomUUID()) {
  return readJson<CanonicalSettings>(await apiFetch("/api/v1/settings", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mutationId, expectedRevision, ...settings, actor }),
  }, true));
}

export async function submitPrintJob(document: ReceiptDocumentV2, rendered: RenderedReceipt, raster: RasterizedReceipt, jobId = crypto.randomUUID(), signal?: AbortSignal) {
  const metadata = {
    id: jobId,
    checksum: raster.checksum,
    rendererVersion: rendered.rendererVersion,
    document,
    width: raster.width,
    height: raster.height,
    feedLines: 4,
    cutMode: "full",
  };
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set("artifact", raster.blob, `${jobId}.png`);
  return readJson<PrintJob>(await apiFetch("/api/v1/print-jobs", { method: "POST", body: form, signal }, true));
}

export async function submitPrintRequest(snapshot: Pick<ReceiptState, "document" | "revision">, rendered: RenderedReceipt, raster: RasterizedReceipt, requester: ApiActor, reason?: string, jobId = crypto.randomUUID(), signal?: AbortSignal) {
  const metadata = {
    id: jobId, mutationId: crypto.randomUUID(), checksum: raster.checksum, rendererVersion: rendered.rendererVersion,
    expectedRevision: snapshot.revision, requester, reason, width: raster.width, height: raster.height, feedLines: 4, cutMode: "full",
  };
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set("artifact", raster.blob, `${jobId}.png`);
  return readJson<PrintJob>(await apiFetch("/api/v1/print-requests", { method: "POST", body: form, signal }, true));
}

export async function decidePrintRequest(jobId: string, decision: "approve" | "reject", actor: ApiActor, signal?: AbortSignal) {
  return readJson<PrintJob>(await apiFetch(`/api/v1/print-requests/${encodeURIComponent(jobId)}/decision`, {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mutationId: crypto.randomUUID(), decision, actor }),
  }, true));
}

export async function listPrintRequests(status?: PrintJobStatus, signal?: AbortSignal) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return readJson<{ items: PrintJob[] }>(await apiFetch(`/api/v1/print-requests${query}`, { signal, cache: "no-store" }));
}

export async function getPrintJob(jobId: string, signal?: AbortSignal) {
  return readJson<PrintJob>(await apiFetch(`/api/v1/print-requests/${encodeURIComponent(jobId)}`, { cache: "no-store", signal }));
}

function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    const complete = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = window.setTimeout(complete, milliseconds);
    const abort = () => {
      window.clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function waitForPrintJob(jobId: string, timeoutMs = 30_000, signal?: AbortSignal) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await getPrintJob(jobId, signal);
    if (["succeeded", "failed", "unknown"].includes(job.status)) return job;
    await abortableDelay(350, signal);
  }
  return getPrintJob(jobId, signal);
}
