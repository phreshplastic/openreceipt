import { Check, ShieldCheck, X } from "lucide-react";
import { receiptTemplates } from "../receipt";
import type { AppSettings, PrintPolicyMode } from "../state/storage";

export function TemplatesModal({ onClose, onLoad }: { onClose(): void; onLoad(id: string): void }) {
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal templates-modal" role="dialog" aria-modal="true" aria-labelledby="templates-title">
    <header className="modal-header"><div><span>Start with a shape</span><h2 id="templates-title">Templates</h2></div><button className="icon-button" onClick={onClose} aria-label="Close templates"><X size={18} /></button></header>
    <div className="template-grid">{receiptTemplates.map((template) => <button type="button" className="template-card" key={template.id} onClick={() => onLoad(template.id)}><div className={`template-mini template-${template.id}`}><strong>{template.id === "blank" ? "A SMALL THING" : "PACKING LIST"}</strong><i /><i /><i /></div><span><strong>{template.name}</strong><small>{template.description}</small></span></button>)}</div>
  </section></div>;
}

const policies: { id: PrintPolicyMode; name: string; description: string }[] = [
  { id: "confirm", name: "Confirm each print", description: "Agent requests wait for you to approve them." },
  { id: "approved", name: "Approved automations", description: "Trusted template revisions may print on their own." },
  { id: "autonomous", name: "Allow agent printing", description: "Agent requests are sent to the printer immediately." },
];

export function SettingsModal({ settings, webMcpAvailable, onChange, onClose }: { settings: AppSettings; webMcpAvailable: boolean; onChange(settings: AppSettings): void; onClose(): void }) {
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header className="modal-header"><div><span>Local preferences</span><h2 id="settings-title">Settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={18} /></button></header>
    <div className="settings-section"><div className="settings-label"><ShieldCheck size={18} /><div><strong>Agent printing</strong><small>Autonomous printing is never the default.</small></div></div><div className="policy-options">{policies.map((policy) => <button type="button" key={policy.id} className={settings.printPolicy === policy.id ? "selected" : ""} onClick={() => onChange({ ...settings, printPolicy: policy.id })}><span className="radio">{settings.printPolicy === policy.id && <Check size={12} />}</span><span><strong>{policy.name}</strong><small>{policy.description}</small></span></button>)}</div>{settings.printPolicy === "approved" && <div className="trusted-templates"><span>Approved template revisions</span>{receiptTemplates.map((template) => <label key={template.id}><input type="checkbox" checked={settings.trustedTemplateIds.includes(template.id)} onChange={(event) => onChange({ ...settings, trustedTemplateIds: event.target.checked ? [...settings.trustedTemplateIds, template.id] : settings.trustedTemplateIds.filter((id) => id !== template.id) })} /><span><strong>{template.name}</strong><small>Revision {template.revision}</small></span></label>)}</div>}</div>
    <div className="settings-note"><span className={`status-dot ${webMcpAvailable ? "online" : ""}`} /><div><strong>{webMcpAvailable ? "WebMCP tools available" : "WebMCP tools unavailable"}</strong><small>{webMcpAvailable ? "This page exposes five receipt tools to compatible agents." : "Human editing still works normally in this browser."}</small></div></div>
  </section></div>;
}

export function ApprovalModal({ title, onApprove, onReject }: { title: string; onApprove(): void; onReject(): void }) {
  return <div className="overlay approval-overlay"><section className="modal approval-modal" role="alertdialog" aria-modal="true" aria-labelledby="approval-title"><span className="approval-mark">PRINT?</span><h2 id="approval-title">An agent wants to print this receipt.</h2><p>Review <strong>{title}</strong> on the canvas, then decide whether to send it to the local printer.</p><div className="modal-actions"><button className="button secondary" onClick={onReject}>Not now</button><button className="button primary" onClick={onApprove}>Approve and print</button></div></section></div>;
}
