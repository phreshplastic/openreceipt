import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, FileStack, PanelRightClose, PanelRightOpen, Printer, Redo2, Undo2 } from "lucide-react";
import type { EditorActivity, PrintStage } from "../App";
import { Brand } from "../components/Brand";
import { BlockLibraryModal } from "../components/BlockLibraryModal";
import { Inspector, type InspectorMode } from "../components/Inspector";
import { MobileFormatBar } from "../components/MobileFormatBar";
import { ReceiptCanvas } from "../components/ReceiptCanvas";
import { SettingsModal, TemplatesModal } from "../components/Overlays";
import { createBlock, renderReceiptSvg, type CoreReceiptBlock, type ReceiptBlock, type ReceiptHistoryStatus, type ReceiptOperation, type ReceiptState } from "../receipt";
import type { CatalogBlockKind } from "../receipt";
import { getLibraryDefinition, type BlockLibraryPreferences, type CatalogInsertConfig, type ReceiptCommand } from "../block-library";
import type { PrototypeBlockId } from "../blocks/types";
import type { AppSettings } from "../state/storage";
import type { ReceiptSyncStatus } from "../state/receiptSession";

type Props = {
  state: ReceiptState;
  settings: AppSettings;
  blockLibraryPreferences: BlockLibraryPreferences;
  webMcpAvailable: boolean;
  printStatus: string;
  printStage: PrintStage;
  bridgeOnline: boolean;
  syncStatus: ReceiptSyncStatus;
  history: ReceiptHistoryStatus;
  editorActivity?: EditorActivity;
  applyOperations(expectedRevision: number, operations: ReceiptOperation[]): ReceiptState;
  applyCommands(expectedRevision: number, commands: ReceiptCommand[], source?: "human" | "agent"): Promise<ReceiptState>;
  loadTemplate(id: string): void;
  updateSettings(settings: AppSettings): void;
  toggleBlockFavorite(id: CatalogBlockKind): void;
  undo(): ReceiptState;
  redo(): ReceiptState;
  refreshBridge(): Promise<boolean>;
  print(): Promise<unknown>;
};

type LibraryState = { index: number; initialId?: PrototypeBlockId };

export function EditorPage({ state, settings, blockLibraryPreferences, webMcpAvailable, printStatus, printStage, bridgeOnline, syncStatus, history, editorActivity, applyOperations, applyCommands, loadTemplate, updateSettings, toggleBlockFavorite, undo, redo, refreshBridge, print }: Props) {
  const rendered = useMemo(() => renderReceiptSvg(state.document), [state.document]);
  const [selectedId, setSelectedId] = useState<string>();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("format");
  const [library, setLibrary] = useState<LibraryState>();
  const [refreshingId, setRefreshingId] = useState<string>();
  const [insertNotice, setInsertNotice] = useState("");
  const [scrollToId, setScrollToId] = useState<string>();
  const canvasPointer = useRef<{ x: number; y: number; moved: boolean } | undefined>(undefined);
  const selected = state.document.blocks.find((block) => block.id === selectedId);
  const apply = (operations: ReceiptOperation[]) => applyOperations(state.revision, operations);
  const replace = (block: ReceiptBlock) => apply([{ type: "replace", id: block.id, block }]);
  const add = (type: CoreReceiptBlock["type"], index: number) => {
    const block = createBlock(type);
    apply([{ type: "add", block, index }]);
    setSelectedId(block.id);
    setInspectorOpen(true);
    setInspectorMode("format");
  };
  const selectBlock = (id: string) => {
    setSelectedId(id);
    setInspectorOpen(true);
    setInspectorMode("format");
  };
  const remove = () => {
    if (!selected) return;
    apply([{ type: "remove", id: selected.id }]);
    setSelectedId(undefined);
  };
  const move = (id: string, toIndex: number) => {
    if (state.document.blocks.findIndex((block) => block.id === id) !== toIndex) apply([{ type: "move", id, toIndex }]);
  };

  const insertionAfterSelection = () => selected ? state.document.blocks.findIndex((block) => block.id === selected.id) + 1 : state.document.blocks.length;
  const openLibrary = (index = insertionAfterSelection(), initialId?: PrototypeBlockId) => setLibrary({ index, initialId });
  const insertCatalog = async (kind: CatalogBlockKind, config?: CatalogInsertConfig, index = library?.index ?? insertionAfterSelection()) => {
    const previousIds = new Set(state.document.blocks.map((block) => block.id));
    const next = await applyCommands(state.revision, [{ type: "insertCatalogBlock", kind, config, index }]);
    const inserted = next.document.blocks.find((block) => !previousIds.has(block.id));
    if (inserted) {
      setSelectedId(inserted.id);
      setScrollToId(inserted.id);
      setInsertNotice(`${getLibraryDefinition(kind)?.name ?? "Block"} added`);
    }
    setInspectorMode("format");
    setInspectorOpen(true);
  };
  const addFavorite = (kind: CatalogBlockKind, index = insertionAfterSelection()) => {
    if (getLibraryDefinition(kind)?.requiresConfiguration) openLibrary(index, kind);
    else void insertCatalog(kind, undefined, index);
  };
  const refreshCatalog = async (id: string) => {
    setRefreshingId(id);
    try { await applyCommands(state.revision, [{ type: "refreshCatalogBlock", id }]); }
    finally { setRefreshingId(undefined); }
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const wantsRedo = (event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y";
      const wantsUndo = event.key.toLowerCase() === "z" && !event.shiftKey;
      if (wantsRedo && history.canRedo) { event.preventDefault(); redo(); }
      else if (wantsUndo && history.canUndo) { event.preventDefault(); undo(); }
    };
    document.addEventListener("keydown", handleHistoryShortcut);
    return () => document.removeEventListener("keydown", handleHistoryShortcut);
  }, [history.canRedo, history.canUndo, redo, undo]);

  useEffect(() => {
    if (!insertNotice) return;
    const timer = window.setTimeout(() => setInsertNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [insertNotice]);

  useEffect(() => {
    if (!scrollToId) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-receipt-block-id="${scrollToId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setScrollToId(undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToId, state.document]);

  const busy = printStage === "rendering" || printStage === "feeding";
  const printerProblem = !bridgeOnline || printStage === "failed" || printStage === "unknown";
  const bridgeLabel = printerProblem ? (printStage === "failed" ? "Printer error" : bridgeOnline ? "Check printer" : "Printer offline") : printStage === "complete" ? "Printed" : "Printer ready";

  return <main className="editor-page">
    <header className="editor-header">
      <div className="editor-leading">
        <Brand compact />
        <span className="toolbar-divider" aria-hidden="true" />
        <button type="button" className="toolbar-button" onClick={() => setTemplatesOpen(true)}><FileStack size={16} /><span>Templates</span></button>
        <span className="toolbar-divider history-divider" aria-hidden="true" />
        <button type="button" className="toolbar-button icon-only" aria-label="Undo" title="Undo (⌘Z)" disabled={!history.canUndo} onClick={undo}><Undo2 size={16} /></button>
        <button type="button" className="toolbar-button icon-only" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!history.canRedo} onClick={redo}><Redo2 size={16} /></button>
      </div>

      <div className="document-title">
        <input aria-label="Receipt title" value={state.document.title} onChange={(event) => { if (event.target.value) apply([{ type: "setTitle", title: event.target.value }]); }} />
        <span><Check size={10} />{syncStatus === "offline" ? "Saved locally · waiting for local API" : syncStatus === "conflict" ? "Choose which version to keep" : syncStatus === "saving" || syncStatus === "connecting" ? "Saving to local API…" : "Saved to local API"}</span>
      </div>

      <div className="header-actions">
        {editorActivity && <div className={`agent-presence-header phase-${editorActivity.phase}`} aria-hidden="true"><Bot size={14} /><span>{editorActivity.message}</span></div>}
        <button
          type="button"
          className={`bridge-state ${bridgeOnline && !printerProblem ? "online" : ""} ${printerProblem ? "problem" : ""}`}
          title={printerProblem ? `${printStatus || "Printer unavailable"} — click to retry` : "Open printer and agent settings"}
          onClick={() => { if (printerProblem) void refreshBridge(); else setSettingsOpen(true); }}
        >
          <CellularBars connected={!printerProblem} />
          <span><strong>{bridgeLabel}</strong><small>{printerProblem ? "Click to retry" : printStage === "complete" ? "Local bridge" : printStatus || "Local bridge"}</small></span>
        </button>
        <button className={`icon-button inspector-toggle ${inspectorOpen ? "active" : ""}`} onClick={() => setInspectorOpen((open) => !open)} aria-label={inspectorOpen ? "Hide format panel" : "Show format panel"} title={inspectorOpen ? "Hide format panel" : "Show format panel"}>{inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</button>
        <button className="button primary print-button" onClick={() => void print().catch(() => undefined)} disabled={busy || !bridgeOnline || syncStatus === "offline" || syncStatus === "conflict"}><Printer size={16} />{printStage === "rendering" ? "Preparing" : printStage === "feeding" ? "Printing" : "Print"}</button>
      </div>
    </header>

    <div className={`editor-layout ${inspectorOpen ? "" : "inspector-collapsed"}`}>
      <section className="canvas-column" id="receipt-preview">
        <div className="canvas-stage"
          onPointerDown={(event) => { canvasPointer.current = { x: event.clientX, y: event.clientY, moved: false }; }}
          onPointerMove={(event) => {
            const start = canvasPointer.current;
            if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) start.moved = true;
          }}
          onPointerCancel={() => { if (canvasPointer.current) canvasPointer.current.moved = true; }}
          onClick={(event) => {
          if (canvasPointer.current?.moved) { canvasPointer.current = undefined; return; }
          canvasPointer.current = undefined;
          if (!(event.target instanceof Element)) return;
          if (!event.currentTarget.contains(event.target)) return;
          if (event.target.closest(".receipt-block-hit, .receipt-inline, .block-drag-grip, .receipt-insertion-point button, .receipt-add-control, .agent-activity")) return;
          setSelectedId(undefined);
        }}>
          <ReceiptCanvas
            rendered={rendered}
            blocks={state.document.blocks}
            selectedId={selectedId}
            recentAgentBlockIds={editorActivity?.blockIds}
            agentActivity={editorActivity}
            onSelect={selectBlock}
            onReplace={replace}
            onMove={move}
            feeding={printStage === "feeding"}
            onAdd={add}
            favoriteIds={blockLibraryPreferences.favoriteIds}
            onAddCatalog={addFavorite}
            onBrowseCatalog={(index) => openLibrary(index)}
          />
          {editorActivity && <div className="agent-activity"><span>{editorActivity.message}</span>{editorActivity.phase === "complete" && editorActivity.blockIds.length > 0 && <button type="button" onClick={undo}>Undo</button>}</div>}
          {insertNotice && !editorActivity && <div className="agent-activity insert-activity" role="status"><span>{insertNotice}</span><button type="button" onClick={() => { undo(); setInsertNotice(""); }}>Undo</button></div>}
        </div>
      </section>
      <Inspector block={selected} canRemove={state.document.blocks.length > 1} mode={inspectorMode} favoriteIds={blockLibraryPreferences.favoriteIds} paperWidth={state.document.page.printableWidthDots} refreshingId={refreshingId} page={state.document.page} settings={settings} bridgeOnline={bridgeOnline} printStatus={printStatus} webMcpAvailable={webMcpAvailable} onModeChange={setInspectorMode} onChange={replace} onRemove={remove} onBrowseLibrary={() => openLibrary()} onInsertFavorite={(id) => addFavorite(id)} onRefreshCatalog={refreshCatalog} onPageChange={(page) => apply([{ type: "setPage", page }])} onSettingsChange={updateSettings} />
    </div>

    <MobileFormatBar block={selected} onChange={replace} />
    <div className="visually-hidden" role="status" aria-live="polite">{editorActivity?.message}</div>

    {templatesOpen && <TemplatesModal onClose={() => setTemplatesOpen(false)} onLoad={(id) => { loadTemplate(id); setTemplatesOpen(false); }} />}
    {settingsOpen && <SettingsModal settings={settings} webMcpAvailable={webMcpAvailable} documentMeta={{ paperWidthMm: state.document.page.paperWidthMm, width: rendered.width, height: rendered.height, revision: state.revision }} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
    {library && <BlockLibraryModal width={state.document.page.printableWidthDots} favoriteIds={blockLibraryPreferences.favoriteIds} initialId={library.initialId} onToggleFavorite={toggleBlockFavorite} onInsert={(kind, config) => insertCatalog(kind, config, library.index)} onClose={() => setLibrary(undefined)} />}
  </main>;
}

function CellularBars({ connected }: { connected: boolean }) {
  const bars = [
    { x: 1.5, y: 14, height: 5 },
    { x: 6.5, y: 11, height: 8 },
    { x: 11.5, y: 7, height: 12 },
    { x: 16.5, y: 3, height: 16 },
  ];
  return <svg className={`cellular-bars ${connected ? "connected" : ""}`} width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
    {bars.map((bar) => <rect key={bar.x} x={bar.x} y={bar.y} width="3" height={bar.height} rx=".7" />)}
  </svg>;
}
