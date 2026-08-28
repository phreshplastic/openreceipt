import type { ReceiptDocumentV1, RasterizedReceipt, RenderedReceipt } from "../receipt";

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

export type PrintJobStatus = "queued" | "sending" | "succeeded" | "failed" | "unknown";

export type PrintJob = {
  id: string;
  status: PrintJobStatus;
  checksum: string;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((value as { detail?: string }).detail ?? `Bridge request failed (${response.status}).`);
  return value as T;
}

export async function getCapabilities(signal?: AbortSignal) {
  return readJson<BridgeCapabilities>(await fetch("/api/v1/capabilities", { signal, cache: "no-store" }));
}

export async function saveConfiguration(profileId: PaperProfile["id"]) {
  return readJson<BridgeCapabilities>(await fetch("/api/v1/configuration", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adapter: "epson-tm-l90-usb", profileId }),
  }));
}

export async function submitPrintJob(document: ReceiptDocumentV1, rendered: RenderedReceipt, raster: RasterizedReceipt, jobId = crypto.randomUUID()) {
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
  return readJson<PrintJob>(await fetch("/api/v1/print-jobs", { method: "POST", body: form }));
}

export async function getPrintJob(jobId: string) {
  return readJson<PrintJob>(await fetch(`/api/v1/print-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" }));
}

export async function waitForPrintJob(jobId: string, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await getPrintJob(jobId);
    if (["succeeded", "failed", "unknown"].includes(job.status)) return job;
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }
  return getPrintJob(jobId);
}
