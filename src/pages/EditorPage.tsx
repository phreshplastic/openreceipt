import { useMemo, useState } from "react";
import { ChevronDown, FileStack, Plus, Printer, Settings2, Wifi, WifiOff } from "lucide-react";
import { Brand } from "../components/Brand";
import { Inspector } from "../components/Inspector";
import { ReceiptCanvas } from "../components/ReceiptCanvas";
import { SettingsModal, TemplatesModal } from "../components/Overlays";
import { createBlock, renderReceiptSvg, type ReceiptBlock, type ReceiptOperation, type ReceiptState } from "../receipt";
import type { AppSettings } from "../state/storage";

type Props = {
  state: ReceiptState;
  settings: AppSettings;
  webMcpAvailable: boolean;
  printStatus: string;
  bridgeOnline: boolean;
  applyOperations(expectedRevision: number, operations: ReceiptOperation[]): ReceiptState;
  loadTemplate(id: string): void;
  updateSettings(settings: AppSettings): void;
  print(): Promise<void>;
};

const blockOptions: { type: ReceiptBlock["type"]; label: string }[] = [
  { type: "heading", label: "Heading" }, { type: "text", label: "Text" }, { type: "checklist", label: "Checklist" },
  { type: "keyValue", label: "Key / value" }, { type: "table", label: "Table" }, { type: "divider", label: "Divider" },
];

export function EditorPage({ state, settings, webMcpAvailable, printStatus, bridgeOnline, applyOperations, loadTemplate, updateSettings, print }: Props) {
  const rendered = useMemo(() => renderReceiptSvg(state.document), [state.document]);
  const [selectedId, setSelectedId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selected = state.document.blocks.find((block) => block.id === selectedId);
  const apply = (operations: ReceiptOperation[]) => applyOperations(state.revision, operations);
  const replace = (block: ReceiptBlock) => apply([{ type: "replace", id: block.id, block }]);
  const add = (type: ReceiptBlock["type"]) => { const block = createBlock(type); apply([{ type: "add", block }]); setSelectedId(block.id); setAdding(false); };
  const remove = () => { if (!selected) return; apply([{ type: "remove", id: selected.id }]); };
  const move = (id: string, toIndex: number) => { if (state.document.blocks.findIndex((block) => block.id === id) !== toIndex) apply([{ type: "move", id, toIndex }]); };

  return <main className="editor-page">
    <header className="editor-header"><Brand compact /><div className="document-title"><input aria-label="Receipt title" value={state.document.title} onChange={(event) => { if (event.target.value) apply([{ type: "setTitle", title: event.target.value }]); }} /><span>Saved locally · revision {state.revision}</span></div><div className="header-actions"><span className={`bridge-state ${bridgeOnline ? "online" : ""}`}>{bridgeOnline ? <Wifi size={14} /> : <WifiOff size={14} />}{bridgeOnline ? "Bridge ready" : "Bridge offline"}</span><button className="button ghost" onClick={() => setTemplatesOpen(true)}><FileStack size={16} />Templates</button><button className="icon-button header-settings" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings2 size={17} /></button><button className="button primary print-button" onClick={() => void print()}><Printer size={16} />Print</button></div></header>
    <div className="editor-layout"><section className="canvas-column" id="receipt-preview"><div className="canvas-toolbar"><div><span>Receipt preview</span><small>{rendered.width} × {rendered.height} dots · {state.document.page.paperWidthMm} mm</small></div><div className="add-control"><button type="button" className="button secondary small" onClick={() => setAdding(!adding)}><Plus size={14} />Add block<ChevronDown size={13} /></button>{adding && <div className="add-menu">{blockOptions.map((option) => <button type="button" key={option.type} onClick={() => add(option.type)}>{option.label}</button>)}</div>}</div></div><div className="canvas-stage"><ReceiptCanvas rendered={rendered} blocks={state.document.blocks} selectedId={selectedId} onSelect={setSelectedId} onReplace={replace} onMove={move} /></div><div className="canvas-footer"><span className={`status-dot ${webMcpAvailable ? "online" : ""}`} /><span>{webMcpAvailable ? "Agent tools are live on this page" : "Human editing mode"}</span>{printStatus && <strong>{printStatus}</strong>}</div></section><Inspector block={selected} canRemove={state.document.blocks.length > 1} onChange={replace} onRemove={remove} /></div>
    {templatesOpen && <TemplatesModal onClose={() => setTemplatesOpen(false)} onLoad={(id) => { loadTemplate(id); setTemplatesOpen(false); }} />}
    {settingsOpen && <SettingsModal settings={settings} webMcpAvailable={webMcpAvailable} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
  </main>;
}
