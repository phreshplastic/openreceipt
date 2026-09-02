import { useMemo } from "react";
import { X } from "lucide-react";
import { renderReceiptSvg } from "../receipt";
import type { ReceiptState } from "../receipt";
import { listTemplateEntries, type TemplateEntry } from "../receipt/templates";
import type { DocumentSeed } from "../receipt/templates";
import type { DraftStore } from "../state/drafts";
import type { AppSettings } from "../state/storage";
import { PaperSurface } from "./PaperSurface";

/**
 * A real receipt, rendered by the renderer that draws the paper — not a drawing of one.
 * `create` mints fresh ids on every call, so this memoizes on the entry id and the seed
 * rather than on the document it returns.
 */
function TemplatePreview({ entry, seed }: { entry: TemplateEntry; seed: DocumentSeed }) {
  const rendered = useMemo(() => renderReceiptSvg(entry.create(seed)), [entry, seed]);
  return <PaperSurface className="template-paper" style={{ aspectRatio: `${rendered.width} / ${rendered.height}` }} dangerouslySetInnerHTML={{ __html: rendered.svg }} />;
}

export function TemplatesModal({ store, seed, onClose, onLoad, onDelete }: { store: DraftStore; seed: DocumentSeed; onClose(): void; onLoad(id: string): void; onDelete?(id: string): void }) {
  const entries = listTemplateEntries(store);
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal templates-modal" role="dialog" aria-modal="true" aria-labelledby="templates-title">
    <header className="modal-header"><h2 id="templates-title">Templates</h2><button className="icon-button" onClick={onClose} aria-label="Close templates"><X size={18} /></button></header>
    <div className="template-grid">{entries.map((entry) => <div className="template-card-shell" key={entry.id}>
      <button type="button" className="template-card" onClick={() => onLoad(entry.id)}>
        <div className="template-preview"><TemplatePreview entry={entry} seed={seed} /></div>
        <span className="template-card-copy"><strong>{entry.name}</strong></span>
      </button>
      {entry.kind === "user" && onDelete && <button type="button" className="template-card-delete" onClick={() => onDelete(entry.id)} aria-label={`Delete template ${entry.name}`} title="Delete template"><X size={13} /></button>}
    </div>)}</div>
  </section></div>;
}

export function ApprovalPanel({ title, reason, revision, width, height, paperWidthMm, policy, destination, approveLabel, onApprove, onReject }: { title: string; reason?: string; revision: number; width: number; height: number; paperWidthMm: number; policy: AppSettings["printPolicy"]; destination?: string; approveLabel?: string; onApprove(): void; onReject(): void }) {
  return <aside className="approval-panel" role="dialog" aria-modal="false" aria-labelledby="approval-title">
    <header><span className="approval-mark">Print request</span><button type="button" className="icon-button" onClick={onReject} aria-label="Keep editing"><X size={15} /></button></header>
    <h2 id="approval-title">An agent wants to print “{title}”.</h2>
    {reason && <p>{reason}</p>}
    <dl>
      <div><dt>Draft</dt><dd>Revision {revision}</dd></div>
      <div><dt>Output</dt><dd>{paperWidthMm} mm · {width} × {height} dots</dd></div>
      <div><dt>Destination</dt><dd>{destination ?? `Local printer · ${policy} policy`}</dd></div>
    </dl>
    <p className="approval-note">You can keep editing; any change cancels this request so the approved draft can’t drift.</p>
    <div className="modal-actions"><button className="button secondary" onClick={onReject}>Keep editing</button><button className="button primary" onClick={onApprove}>{approveLabel ?? "Approve and print"}</button></div>
  </aside>;
}

export function ReceiptConflictPanel({ local, shared, onUseShared, onKeepLocal }: { local: ReceiptState; shared: ReceiptState; onUseShared(): void; onKeepLocal(): void }) {
  return <aside className="approval-panel conflict-panel" role="dialog" aria-modal="false" aria-labelledby="conflict-title">
    <header><span className="approval-mark">Receipt changed</span></header>
    <h2 id="conflict-title">Keep yours, or take the incoming version?</h2>
    <p>You were editing this receipt when another change arrived. Nothing is overwritten until you choose.</p>
    <dl>
      <div><dt>Yours</dt><dd>{local.document.title} · revision {local.revision}</dd></div>
      <div><dt>Incoming</dt><dd>{shared.document.title} · revision {shared.revision}</dd></div>
    </dl>
    <div className="modal-actions"><button className="button secondary" onClick={onUseShared}>Use incoming</button><button className="button primary" onClick={onKeepLocal}>Keep mine</button></div>
  </aside>;
}

