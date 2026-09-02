import { renderReceiptSvg, type ReceiptDocument } from "../receipt";

export type DemoPrintResult = {
  opened: boolean;
  downloaded: boolean;
};

export type DemoPrintStage = "feeding" | "complete";

/** Editor print-button motion before the preview tab opens. */
export const DEMO_PRINT_FEED_MS = 1800;
/** How long the check stays on the button before it returns to Print. */
export const PRINT_DONE_HOLD_MS = 700;

const PREVIEW_WINDOW = "openreceipt-preview";

type PlayDemoPrintOptions = {
  delayMs?: number;
  onStage?(stage: DemoPrintStage): void;
};

export function receiptPreviewFilename(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "receipt"}.svg`;
}

export function receiptPreviewHtml(svg: string, title: string): string {
  const escaped = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escaped}</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #ece8df; }
    body { display: grid; place-items: start center; padding: 32px 16px 64px; }
    .slip { background: #fff; box-shadow: 0 18px 40px rgb(20 16 10 / 18%); }
    svg { display: block; width: min(420px, 92vw); height: auto; }
  </style>
</head>
<body>
  <div class="slip">${svg}</div>
</body>
</html>`;
}

export function openReceiptPreview(document: ReceiptDocument): DemoPrintResult {
  return openPreviewHtml(previewHtmlFor(document));
}

export async function playDemoPrint(document: ReceiptDocument, options: PlayDemoPrintOptions = {}): Promise<DemoPrintResult> {
  const html = previewHtmlFor(document);
  options.onStage?.("feeding");
  const delayMs = prefersReducedMotion() ? 0 : (options.delayMs ?? DEMO_PRINT_FEED_MS);
  if (delayMs > 0) await sleep(delayMs);
  const result = openPreviewHtml(html);
  options.onStage?.("complete");
  return result;
}

function previewHtmlFor(document: ReceiptDocument) {
  const rendered = renderReceiptSvg(document);
  return receiptPreviewHtml(rendered.svg, document.title);
}

function openPreviewHtml(html: string): DemoPrintResult {
  const url = blobUrl(html, "text/html;charset=utf-8");
  try {
    const opened = window.open(url, PREVIEW_WINDOW);
    if (opened) {
      opened.opener = null;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return { opened: true, downloaded: false };
    }
  } catch {
    // Fall through to a download if the browser refused the tab.
  }
  URL.revokeObjectURL(url);
  downloadFile(html, "receipt.html", "text/html;charset=utf-8");
  return { opened: false, downloaded: true };
}

function blobUrl(contents: string, type: string) {
  return URL.createObjectURL(new Blob([contents], { type }));
}

function downloadFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] ?? character));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
