import { CheckCircle2, Clock3, FilePlus, FileStack, Printer, TriangleAlert, X } from "lucide-react";
import type { PrintJob } from "../bridge/client";
import { WebMcpTools } from "./WebMcpTools";

export type RailDraft = { id: string; title: string; updatedAt: string };

type Props = {
  printJobs: PrintJob[];
  drafts: RailDraft[];
  activeDraftId: string;
  /** Surfaced when a save could not reach browser storage, so a lost draft is never silent. */
  saveNotice?: string;
  onOpenDraft(id: string): void;
  onDeleteDraft(id: string): void;
  onNewBlank(): void;
  onBrowseTemplates(): void;
  webMcpAvailable: boolean;
};

const jobLabels: Record<PrintJob["status"], string> = {
  awaiting_approval: "Needs approval",
  queued: "Queued",
  sending: "Printing",
  succeeded: "Printed",
  failed: "Failed",
  unknown: "Check paper",
  rejected: "Rejected",
  stale: "Out of date",
  cancelled: "Cancelled",
};

function JobMark({ status }: { status: PrintJob["status"] }) {
  if (status === "succeeded") return <CheckCircle2 aria-hidden="true" />;
  if (status === "failed" || status === "unknown") return <TriangleAlert aria-hidden="true" />;
  if (status === "sending" || status === "queued") return <Printer aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Rows carry their own age, which is more use on a shelf than repeating a header status. */
export function formatDraftAge(value: string, now = Date.now()) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function ReceiptRail({
  printJobs, drafts, activeDraftId, saveNotice,
  onOpenDraft, onDeleteDraft, onNewBlank, onBrowseTemplates, webMcpAvailable,
}: Props) {
  const orderedDrafts = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return <aside className="receipt-rail" id="receipt-drafts-rail" aria-label="Drafts and print queue">
    <div className="rail-scroll">
      <div className="rail-new-actions">
        <button type="button" className="rail-template-button rail-new-action" onClick={onNewBlank}>
          <FilePlus size={15} />
          <span>New blank</span>
        </button>
        <button type="button" className="rail-template-button rail-new-action" onClick={onBrowseTemplates}>
          <FileStack size={15} />
          <span>New from template</span>
        </button>
      </div>

      <section className="rail-section" aria-labelledby="drafts-heading">
        <h2 id="drafts-heading" className="rail-heading-plain">Drafts</h2>

        {orderedDrafts.map((draft) => <div key={draft.id} className={`receipt-rail-row ${draft.id === activeDraftId ? "active" : ""}`}>
          <button type="button" className="receipt-rail-open" onClick={() => onOpenDraft(draft.id)} aria-label={draft.title || "Untitled"} aria-current={draft.id === activeDraftId ? "page" : undefined}>
            <span className="receipt-rail-row-copy"><strong>{draft.title || "Untitled"}</strong><small>{formatDraftAge(draft.updatedAt)}</small></span>
          </button>
          <button type="button" className="rail-row-action" onClick={() => onDeleteDraft(draft.id)} aria-label={`Delete draft ${draft.title || "Untitled"}`} title="Delete draft"><X size={13} /></button>
        </div>)}
      </section>

      {printJobs.length > 0 && <section className="rail-section print-queue-section" aria-labelledby="print-queue-heading">
        <h2 id="print-queue-heading" className="rail-heading-plain">Print queue</h2>
        <ol className="print-activity-list">
          {printJobs.slice(0, 2).map((job) => <li key={job.id} className={`print-activity-row status-${job.status}`}>
            <span className="print-activity-mark"><JobMark status={job.status} /></span>
            <span>
              <strong>{job.document?.title || "Receipt"}</strong>
              <small>{jobLabels[job.status]}{job.updatedAt ? ` · ${formatTime(job.updatedAt)}` : ""}</small>
            </span>
          </li>)}
        </ol>
      </section>}
    </div>

    {saveNotice && <p className="rail-notice" role="status">{saveNotice}</p>}

    <WebMcpTools registered={webMcpAvailable} />
  </aside>;
}
