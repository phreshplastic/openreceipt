import { Check, FileText, ShieldCheck, X } from "lucide-react";
import { receiptTemplates } from "../receipt";
import type { ReceiptState } from "../receipt";
import { printPolicies, type AppSettings } from "../state/storage";

export function TemplatesModal({ onClose, onLoad }: { onClose(): void; onLoad(id: string): void }) {
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal templates-modal" role="dialog" aria-modal="true" aria-labelledby="templates-title">
    <header className="modal-header"><div><span>Start with a shape</span><h2 id="templates-title">Templates</h2></div><button className="icon-button" onClick={onClose} aria-label="Close templates"><X size={18} /></button></header>
    <div className="template-grid">{receiptTemplates.map((template) => <button type="button" className="template-card" key={template.id} onClick={() => onLoad(template.id)}><div className={`template-mini template-${template.id}`}><strong>{template.id === "blank" ? "A SMALL THING" : "PACKING LIST"}</strong><i /><i /><i /></div><span><strong>{template.name}</strong><small>{template.description}</small></span></button>)}</div>
  </section></div>;
}

type DocumentMeta = { paperWidthMm: number; width: number; height: number; revision: number };

export function SettingsModal({ settings, webMcpAvailable, documentMeta, onChange, onClose }: { settings: AppSettings; webMcpAvailable: boolean; documentMeta: DocumentMeta; onChange(settings: AppSettings): void; onClose(): void }) {
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header className="modal-header"><div><span>Local preferences</span><h2 id="settings-title">Settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={18} /></button></header>
    <div className="settings-section"><div className="settings-label"><ShieldCheck size={18} /><div><strong>Agent printing</strong><small>Autonomous printing is never the default.</small></div></div><div className="policy-options">{printPolicies.map((policy) => <button type="button" key={policy.id} className={settings.printPolicy === policy.id ? "selected" : ""} onClick={() => onChange({ ...settings, printPolicy: policy.id })}><span className="radio">{settings.printPolicy === policy.id && <Check size={12} />}</span><span><strong>{policy.name}</strong><small>{policy.description}</small></span></button>)}</div>{settings.printPolicy === "approved" && <div className="trusted-templates"><span>Approved template revisions</span>{receiptTemplates.map((template) => <label key={template.id}><input type="checkbox" checked={settings.trustedTemplateIds.includes(template.id)} onChange={(event) => onChange({ ...settings, trustedTemplateIds: event.target.checked ? [...settings.trustedTemplateIds, template.id] : settings.trustedTemplateIds.filter((id) => id !== template.id) })} /><span><strong>{template.name}</strong><small>Revision {template.revision}</small></span></label>)}</div>}</div>
    <div className="document-meta"><FileText size={18} /><div><strong>Current document</strong><small>{documentMeta.paperWidthMm} mm paper · {documentMeta.width} × {documentMeta.height} dots · revision {documentMeta.revision}</small></div></div>
    <div className="settings-note"><span className={`status-dot ${webMcpAvailable ? "online" : ""}`} /><div><strong>{webMcpAvailable ? "WebMCP tools available" : "WebMCP tools unavailable"}</strong><small>{webMcpAvailable ? "This page exposes seven receipt tools to compatible agents." : "Human editing still works normally in this browser."}</small></div></div>
  </section></div>;
}

export function ApprovalPanel({ title, reason, revision, width, height, paperWidthMm, policy, onApprove, onReject }: { title: string; reason?: string; revision: number; width: number; height: number; paperWidthMm: number; policy: AppSettings["printPolicy"]; onApprove(): void; onReject(): void }) {
  return <aside className="approval-panel" role="dialog" aria-modal="false" aria-labelledby="approval-title">
    <header><span className="approval-mark">Print request</span><button type="button" className="icon-button" onClick={onReject} aria-label="Keep editing"><X size={15} /></button></header>
    <h2 id="approval-title">An agent wants to print “{title}”.</h2>
    {reason && <p>{reason}</p>}
    <dl>
      <div><dt>Draft</dt><dd>Revision {revision}</dd></div>
      <div><dt>Output</dt><dd>{paperWidthMm} mm · {width} × {height} dots</dd></div>
      <div><dt>Destination</dt><dd>Local printer · {policy} policy</dd></div>
    </dl>
    <p className="approval-note">You can keep editing; any change cancels this request so the approved draft can’t drift.</p>
    <div className="modal-actions"><button className="button secondary" onClick={onReject}>Keep editing</button><button className="button primary" onClick={onApprove}>Approve and print</button></div>
  </aside>;
}

export function ReceiptConflictPanel({ local, shared, onUseShared, onKeepLocal }: { local: ReceiptState; shared: ReceiptState; onUseShared(): void; onKeepLocal(): void }) {
  return <aside className="approval-panel conflict-panel" role="dialog" aria-modal="false" aria-labelledby="conflict-title">
    <header><span className="approval-mark">Shared receipt changed</span></header>
    <h2 id="conflict-title">Choose the version you want to continue with.</h2>
    <p>Your offline draft and the shared receipt are both preserved. Nothing will be merged or overwritten until you choose.</p>
    <dl>
      <div><dt>Your draft</dt><dd>“{local.document.title}” · revision {local.revision}</dd></div>
      <div><dt>Shared</dt><dd>“{shared.document.title}” · revision {shared.revision}</dd></div>
    </dl>
    <div className="modal-actions"><button className="button secondary" onClick={onUseShared}>Use shared version</button><button className="button primary" onClick={onKeepLocal}>Keep my version</button></div>
  </aside>;
}
