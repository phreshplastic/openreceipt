import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bot, Check, ChevronDown, FileStack, List, Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { isAgentWorking } from "../agent/captions";
import type { EditorActivity, PrintStage } from "../App";
import type { PrintJob } from "../bridge/client";
import { Brand } from "../components/Brand";
import { BlockLibraryModal } from "../components/BlockLibraryModal";
import { Inspector, InspectorSheet, type InspectorMode } from "../components/Inspector";
import { MobileFormatBar } from "../components/MobileFormatBar";
import { PersonalizationFlow } from "../components/PersonalizationFlow";
import { PrintButton } from "../components/PrintButton";
import { ReceiptCanvas } from "../components/ReceiptCanvas";
import { ReceiptRail } from "../components/ReceiptRail";
import { TemplatesModal } from "../components/Overlays";
import { createBlock, createLogoBlock, renderReceiptSvg, type CoreReceiptBlock, type ReceiptBlock, type ReceiptDocument, type ReceiptHistoryStatus, type ReceiptOperation, type ReceiptState } from "../receipt";
import { restyleLogo } from "../blocks/wordmarks";
import type { CatalogBlockKind } from "../receipt";
import { configDescriptorFor, favoriteInsertPlan, getLibraryDefinition, type BlockLibraryPreferences, type CatalogInsertConfig, type ConfigValues, type ReceiptCommand, type UserDefaults } from "../block-library";
import type { PrototypeBlockId } from "../blocks/types";
import type { AppSettings } from "../state/storage";
import type { ReceiptSyncStatus } from "../state/receiptSession";
import { documentSeed, recommendedBlocks } from "../onboarding/profile";
import { loadPrintDestination, savePrintDestination, type PrintDestination } from "../printing/destination";
import { createFromTemplateEntry } from "../receipt/templates";
import { matchTemplate, summarizeTemplates, type AgentShelf } from "../state/shelf";
import { deleteDraft, deleteTemplate, loadDraftStore, persistDraftStore, saveDraft, saveTemplate, setActiveDraft, uniqueDraftTitle, upsertTemplate, type DraftStore } from "../state/drafts";

export type RuntimeMode = "demo" | "local";
const WELCOME_DISMISSED_KEY = "petes-printer:first-visit-welcome:v1";
const DRAFT_AUTOSAVE_MS = 400;
type DraftSaveState = "saved" | "saving";

type Props = {
  state: ReceiptState;
  settings: AppSettings;
  blockLibraryPreferences: BlockLibraryPreferences;
  webMcpAvailable: boolean;
  printStatus: string;
  printStage: PrintStage;
  printJobs: PrintJob[];
  printerConnected?: boolean;
  syncStatus: ReceiptSyncStatus;
  history: ReceiptHistoryStatus;
  editorActivity?: EditorActivity;
  applyOperations(expectedRevision: number, operations: ReceiptOperation[]): ReceiptState;
  applyCommands(expectedRevision: number, commands: ReceiptCommand[], source?: "human" | "agent"): Promise<ReceiptState>;
  loadTemplate(id: string, document?: ReceiptDocument): void;
  loadDocument(document: ReceiptDocument): void;
  updateSettings(settings: AppSettings): void;
  toggleBlockFavorite(id: CatalogBlockKind): void;
  undo(): ReceiptState;
  redo(): ReceiptState;
  refreshBridge(): Promise<boolean>;
  print(destination: PrintDestination): Promise<unknown>;
  runtimeMode?: RuntimeMode;
  registerShelf?(shelf: AgentShelf | undefined): void;
};

type LibraryState = { index: number; initialId?: PrototypeBlockId };

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Keep overlay markup mounted through the close transition so it can slide away instead of snapping off. */
function usePresence(open: boolean, durationMs = 340) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = window.setTimeout(() => setPresent(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, open]);
  return present;
}

function isTextBlock(block?: ReceiptBlock): block is Extract<ReceiptBlock, { type: "heading" | "text" }> {
  return block?.type === "heading" || block?.type === "text";
}

export function EditorPage({ state, settings, blockLibraryPreferences, webMcpAvailable, printStatus, printStage, printJobs, printerConnected = false, syncStatus, history, editorActivity, applyOperations, applyCommands, loadTemplate, loadDocument, updateSettings, toggleBlockFavorite, undo, redo, refreshBridge, print, runtimeMode = "local", registerShelf }: Props) {
  const rendered = useMemo(() => renderReceiptSvg(state.document), [state.document]);
  const [selectedId, setSelectedId] = useState<string>();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  const phoneViewport = useMediaQuery("(max-width: 680px)");
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => localStorage.getItem(WELCOME_DISMISSED_KEY) === "1");
  // The rail no longer has a collapse control, but the flag stays: `.rail-open` on the page
  // is what the responsive header keys off to show or hide the Drafts and Templates buttons.
  const [railOpen] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("format");
  const [library, setLibrary] = useState<LibraryState>();
  const [catalogBusy, setCatalogBusy] = useState<{ id: string; kind: "refresh" | "reconfigure" }>();
  const [catalogError, setCatalogError] = useState<{ id: string; message: string }>();
  const [insertNotice, setInsertNotice] = useState("");
  const [scrollToId, setScrollToId] = useState<string>();
  const [draftStore, setDraftStore] = useState<DraftStore>(loadDraftStore);
  const [saveNotice, setSaveNotice] = useState("");
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>("saved");
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [destination, setDestination] = useState<PrintDestination>(() => loadPrintDestination());
  const [destinationMenuOpen, setDestinationMenuOpen] = useState(false);
  const canvasPointer = useRef<{ x: number; y: number; moved: boolean } | undefined>(undefined);
  const lastFormatBlock = useRef<ReceiptBlock | undefined>(undefined);
  const draftStoreRef = useRef(draftStore);
  const documentRef = useRef(state.document);
  const skipAutosaveRef = useRef(false);
  const startNewDraftRef = useRef(false);
  const firstDocumentEffectRef = useRef(true);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const destinationMenuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    draftStoreRef.current = draftStore;
    documentRef.current = state.document;
  });
  const selected = state.document.blocks.find((block) => block.id === selectedId);
  if (selected && !isTextBlock(selected)) lastFormatBlock.current = selected;
  const formatSheetOpen = phoneViewport && !!selected && !isTextBlock(selected);
  const formatSheetBlock = (formatSheetOpen ? selected : lastFormatBlock.current);
  const formatSheetPresent = usePresence(formatSheetOpen);
  const draftsPresent = usePresence(draftsOpen);
  const defaults: UserDefaults = { location: settings.defaultLocation, unit: settings.defaultUnit, ownerFirstName: settings.printerProfile.ownerFirstName };
  const recommendedIds = useMemo(() => recommendedBlocks(settings.printerProfile.useCaseIds), [settings.printerProfile.useCaseIds]);
  const showWelcome = !settings.printerProfile.completed && !welcomeDismissed;
  const dismissWelcome = useCallback(() => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
    setWelcomeDismissed(true);
  }, []);
  const openPersonalization = useCallback(() => setPersonalizationOpen(true), []);
  const closePersonalization = useCallback(() => setPersonalizationOpen(false), []);
  const completePersonalization = useCallback((printerProfile: AppSettings["printerProfile"]) => {
    updateSettings({ ...settings, printerProfile });
    dismissWelcome();
    setPersonalizationOpen(false);
    // Naming the printer has to show up on the paper, or the choice was theatre.
    const previous = settings.printerProfile;
    const sign = state.document.blocks.find((block) => block.type === "catalog" && block.kind === "logo");
    if (sign?.type === "catalog" && sign.kind === "logo") {
      const data = restyleLogo(sign.data, printerProfile.identityId, printerProfile.ownerFirstName, previous.ownerFirstName);
      applyOperations(state.revision, [{ type: "replace", id: sign.id, block: { ...sign, data } }]);
    } else {
      applyOperations(state.revision, [{ type: "add", block: createLogoBlock({ ownerFirstName: printerProfile.ownerFirstName, identityId: printerProfile.identityId }), index: 0 }]);
    }
    setSelectedId(undefined);
    setInspectorOpen(true);
    setInspectorMode(printerProfile.useCaseIds.length ? "library" : "format");
  }, [applyOperations, dismissWelcome, settings, state.document.blocks, state.revision, updateSettings]);
  const commitStore = useCallback((next: DraftStore) => {
    draftStoreRef.current = next;
    setDraftStore(next);
    // A shelf of whole receipts is the one store here that can exhaust the browser's quota,
    // so a refused write is reported rather than swallowed.
    const persisted = persistDraftStore(next);
    setSaveNotice(persisted ? "" : "This browser would not save the shelf — it may be out of space.");
    return persisted;
  }, []);
  const flushDraft = useCallback((options?: { asNew?: boolean; store?: DraftStore; document?: ReceiptDocument }) => {
    const store = options?.store ?? draftStoreRef.current;
    const document = options?.document ?? documentRef.current;
    const saved = saveDraft(store, {
      id: options?.asNew ? undefined : (store.activeId || undefined),
      title: document.title,
      document,
    });
    if (saved === store) return saved;
    commitStore(saved);
    return saved;
  }, [commitStore]);
  const saveCurrentDraft = useCallback(() => {
    startNewDraftRef.current = false;
    flushDraft();
    setDraftSaveState("saved");
  }, [flushDraft]);
  const saveCurrentTemplate = useCallback(() => {
    commitStore(saveTemplate(draftStoreRef.current, { name: documentRef.current.title, document: documentRef.current }));
  }, [commitStore]);
  useEffect(() => {
    if (!registerShelf) return;
    const seed = documentSeed(settings.printerProfile);
    registerShelf({
      listTemplates: () => summarizeTemplates(draftStoreRef.current),
      saveTemplate(name, document) {
        const result = upsertTemplate(draftStoreRef.current, name, document);
        if (!commitStore(result.store)) throw new Error("This browser would not save the template — it may be out of space.");
        return { id: result.id, name: result.name, kind: "user", updated: result.updated };
      },
      resolveTemplate: (idOrName, resolveSeed) => matchTemplate(draftStoreRef.current, idOrName, resolveSeed ?? seed),
    });
    return () => registerShelf(undefined);
  }, [commitStore, registerShelf, settings.printerProfile]);
  const openDraft = useCallback((id: string) => {
    if (id === draftStoreRef.current.activeId) return;
    const store = draftStoreRef.current.activeId ? flushDraft() : draftStoreRef.current;
    const draft = store.drafts.find((candidate) => candidate.id === id);
    if (!draft) return;
    skipAutosaveRef.current = true;
    startNewDraftRef.current = false;
    loadDocument(structuredClone(draft.document));
    commitStore(setActiveDraft(store, id));
  }, [commitStore, flushDraft, loadDocument]);
  const openTemplate = useCallback((id: string) => {
    const store = draftStoreRef.current.activeId ? flushDraft() : draftStoreRef.current;
    startNewDraftRef.current = true;
    skipAutosaveRef.current = false;
    // A built-in keeps going through loadTemplate so it still stamps its provenance; a saved
    // template deliberately does not, which is what keeps it out of the trusted-print path.
    const created = createFromTemplateEntry(store, id, documentSeed(settings.printerProfile));
    if (!created) return;
    // The paper heading can stay "Morning briefing"; the shelf name has to be unique or
    // every blank looks identical. Blank receipts take Untitled rather than repeating it.
    const base = id === "blank" ? "Untitled" : created.document.title;
    const titled = { ...created.document, title: uniqueDraftTitle(base, store.drafts.map((draft) => draft.title)) };
    if (created.template.kind === "builtin") loadTemplate(id, titled);
    else loadDocument(titled);
  }, [flushDraft, loadDocument, loadTemplate, settings.printerProfile]);
  const openBlank = useCallback(() => openTemplate("blank"), [openTemplate]);
  const closeDrafts = useCallback(() => setDraftsOpen(false), []);
  const openDraftFromRail = useCallback((id: string) => {
    openDraft(id);
    setDraftsOpen(false);
  }, [openDraft]);
  const openBlankFromRail = useCallback(() => {
    openBlank();
    setDraftsOpen(false);
  }, [openBlank]);
  const browseTemplatesFromRail = useCallback(() => {
    setDraftsOpen(false);
    setTemplatesOpen(true);
  }, []);
  const removeDraft = useCallback((id: string) => {
    if (id === draftStoreRef.current.activeId) skipAutosaveRef.current = true;
    commitStore(deleteDraft(draftStoreRef.current, id));
  }, [commitStore]);
  const removeTemplate = useCallback((id: string) => {
    commitStore(deleteTemplate(draftStoreRef.current, id));
  }, [commitStore]);

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
    const plan = favoriteInsertPlan(kind, defaults);
    if (plan.action === "library") openLibrary(index, kind);
    else void insertCatalog(kind, plan.config, index);
  };
  const refreshCatalog = async (id: string) => {
    setCatalogBusy({ id, kind: "refresh" });
    setCatalogError(undefined);
    try { await applyCommands(state.revision, [{ type: "refreshCatalogBlock", id }]); }
    finally { setCatalogBusy(undefined); }
  };
  // A failed fetch commits nothing, so the block keeps its last good data and its old settings.
  const reconfigureCatalog = async (id: string, values: ConfigValues) => {
    const block = state.document.blocks.find((candidate) => candidate.id === id);
    const descriptor = block?.type === "catalog" ? configDescriptorFor(block.kind) : undefined;
    if (!descriptor) return;
    setCatalogBusy({ id, kind: "reconfigure" });
    setCatalogError(undefined);
    try {
      await applyCommands(state.revision, [{ type: "reconfigureCatalogBlock", id, config: descriptor.toInsertConfig(values, defaults) }]);
    } catch (error) {
      setCatalogError({ id, message: error instanceof Error ? error.message : "Could not update this block." });
    } finally { setCatalogBusy(undefined); }
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

  useEffect(() => {
    if (firstDocumentEffectRef.current) {
      firstDocumentEffectRef.current = false;
      if (!draftStoreRef.current.activeId) flushDraft();
      setDraftSaveState("saved");
      return;
    }
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      setDraftSaveState("saved");
      return;
    }
    const asNew = startNewDraftRef.current;
    const delay = asNew ? 0 : DRAFT_AUTOSAVE_MS;
    setDraftSaveState("saving");
    const timer = window.setTimeout(() => {
      startNewDraftRef.current = false;
      flushDraft({ asNew });
      setDraftSaveState("saved");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [flushDraft, state.document]);

  useEffect(() => {
    if (!saveMenuOpen && !destinationMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && saveMenuRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && destinationMenuRef.current?.contains(event.target)) return;
      setSaveMenuOpen(false);
      setDestinationMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSaveMenuOpen(false);
        setDestinationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [destinationMenuOpen, saveMenuOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1101px)");
    const closeWhenWide = () => { if (media.matches) setDraftsOpen(false); };
    media.addEventListener("change", closeWhenWide);
    closeWhenWide();
    return () => media.removeEventListener("change", closeWhenWide);
  }, []);

  useEffect(() => {
    if (!draftsOpen && !formatSheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (draftsOpen) {
        setDraftsOpen(false);
        return;
      }
      setSelectedId(undefined);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [draftsOpen, formatSheetOpen]);

  const chooseDestination = useCallback((next: PrintDestination) => {
    setDestination(next);
    savePrintDestination(next);
    setDestinationMenuOpen(false);
  }, []);

  const busy = printStage === "rendering" || printStage === "feeding";
  const complete = printStage === "complete";
  const printerUnavailable = destination === "printer" && runtimeMode === "demo";
  const printDisabled = busy || complete || syncStatus === "conflict" || printerUnavailable;
  const destinationLabel = destination === "printer" ? "Epson printer" : "Demo print";
  const destinationOnline = destination === "demo" || printerConnected;
  const printerDetail = printerConnected ? "Epson TM-L90" : "Not connected";

  return <main className={`editor-page ${railOpen ? "rail-open" : "rail-collapsed"}${draftsOpen ? " drafts-open" : draftsPresent ? " drafts-closing" : ""}${formatSheetPresent ? " format-sheet-open" : ""}`}>
    <header className="editor-header">
      <div className="editor-leading">
        <Brand compact href="/" />
        <span className="toolbar-divider wordmark-divider" aria-hidden="true" />
        <button
          type="button"
          className="toolbar-button header-drafts-button"
          aria-label="Drafts"
          aria-expanded={draftsOpen}
          aria-controls="receipt-drafts-rail"
          onClick={() => setDraftsOpen((open) => !open)}
        >
          <List size={16} /><span>Drafts</span>
        </button>
        <button type="button" className="toolbar-button header-template-button" aria-label="Templates" onClick={() => { setDraftsOpen(false); setTemplatesOpen(true); }}><FileStack size={16} /><span>Templates</span></button>
        <span className="toolbar-divider history-divider" aria-hidden="true" />
        <div className="save-as" ref={saveMenuRef}>
          <button
            type="button"
            className="toolbar-button save-as-button"
            aria-haspopup="menu"
            aria-expanded={saveMenuOpen}
            aria-label={draftSaveState === "saving" ? "Save as, saving" : "Save as, saved"}
            onClick={() => {
              setDestinationMenuOpen(false);
              setSaveMenuOpen((open) => !open);
            }}
          >
            {draftSaveState === "saved" && <Check size={12} />}
            <span>{draftSaveState === "saving" ? "Saving…" : "Saved"}</span>
            <ChevronDown size={12} />
          </button>
          {saveMenuOpen && <div className="add-menu save-as-menu" role="menu" aria-label="Save as">
            <button type="button" role="menuitem" onClick={() => { saveCurrentDraft(); setSaveMenuOpen(false); }}>
              Save as draft
              <small>{draftSaveState === "saving" ? "Saving…" : "Auto-saved"}</small>
            </button>
            <button type="button" role="menuitem" onClick={() => { saveCurrentTemplate(); setSaveMenuOpen(false); }}>
              Save as template
            </button>
          </div>}
        </div>
        <button type="button" className="toolbar-button icon-only" aria-label="Undo" title="Undo (⌘Z)" disabled={!history.canUndo} onClick={undo}><Undo2 size={16} /></button>
        <button type="button" className="toolbar-button icon-only" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!history.canRedo} onClick={redo}><Redo2 size={16} /></button>
        <span className="toolbar-divider zoom-divider" aria-hidden="true" />
        <div className="preview-zoom" aria-label="Receipt preview zoom">
          <button type="button" className="toolbar-button icon-only" aria-label="Zoom out" title="Zoom out" disabled={previewZoom <= 80} onClick={() => setPreviewZoom((value) => Math.max(80, value - 10))}><ZoomOut size={15} /></button>
          <span>{previewZoom}%</span>
          <button type="button" className="toolbar-button icon-only" aria-label="Zoom in" title="Zoom in" disabled={previewZoom >= 140} onClick={() => setPreviewZoom((value) => Math.min(140, value + 10))}><ZoomIn size={15} /></button>
        </div>
      </div>

      <div className="header-actions">
        {editorActivity && editorActivity.phase !== "complete" && <div className={`agent-presence-header phase-${editorActivity.phase}`} aria-hidden="true">
          <Bot size={14} />
          {isAgentWorking(editorActivity.phase) && <span className="agent-working"><i /><i /><i /></span>}
        </div>}
        <div className="print-controls">
          <div className="save-as print-destination" ref={destinationMenuRef}>
            <button
              type="button"
              className="toolbar-button save-as-button print-destination-button"
              aria-haspopup="menu"
              aria-expanded={destinationMenuOpen}
              aria-label={`Print destination, ${destinationLabel}`}
              onClick={() => {
                setSaveMenuOpen(false);
                setDestinationMenuOpen((open) => {
                  const next = !open;
                  if (next) void refreshBridge();
                  return next;
                });
              }}
            >
              <span className={`status-dot ${destinationOnline ? "online" : "offline"}`} />
              <span>{destinationLabel}</span>
              <ChevronDown size={12} />
            </button>
            {destinationMenuOpen && <div className="add-menu save-as-menu print-destination-menu" role="menu" aria-label="Print destination">
              <button type="button" role="menuitemradio" aria-checked={destination === "demo"} onClick={() => chooseDestination("demo")}>
                <span className="status-dot online" />
                <span className="print-destination-copy">
                  Demo print
                  <small>Open a preview in this browser</small>
                </span>
                {destination === "demo" && <Check size={12} />}
              </button>
              <button type="button" role="menuitemradio" aria-checked={destination === "printer"} onClick={() => chooseDestination("printer")}>
                <span className={`status-dot ${printerConnected ? "online" : "offline"}`} />
                <span className="print-destination-copy">
                  Epson printer
                  <small>{printerDetail}</small>
                </span>
                {destination === "printer" && <Check size={12} />}
              </button>
            </div>}
          </div>
          <PrintButton
            busy={busy}
            complete={complete}
            disabled={printDisabled}
            title={printerUnavailable ? "No printer on this site. Choose Demo print." : syncStatus === "conflict" ? "Resolve the receipt conflict before printing." : printStatus || undefined}
            onClick={() => void print(destination).catch(() => undefined)}
          />
        </div>
      </div>
    </header>

    {showWelcome && <div className="mobile-first-visit"><div><strong>This is a real receipt.</strong><span>Edit any line or add a block.</span></div><button type="button" className="button primary" onClick={openPersonalization}>Make it mine</button><button type="button" className="icon-button" onClick={dismissWelcome} aria-label="Not now">×</button></div>}

    {draftsOpen && <button type="button" className="drafts-backdrop" aria-label="Close drafts" onClick={closeDrafts} />}

    <div className="editor-body">
    {railOpen && <ReceiptRail
      printJobs={printJobs}
      drafts={draftStore.drafts.map((draft) => ({ id: draft.id, title: draft.title, updatedAt: draft.updatedAt }))}
      activeDraftId={draftStore.activeId}
      saveNotice={saveNotice}
      onOpenDraft={openDraftFromRail}
      onDeleteDraft={removeDraft}
      onNewBlank={openBlankFromRail}
      onBrowseTemplates={browseTemplatesFromRail}
      webMcpAvailable={webMcpAvailable}
    />}

    <div className="editor-workspace">
    <div className={`editor-layout ${inspectorOpen ? "" : "inspector-collapsed"}`}>
      <section className="canvas-column" id="receipt-preview">
        <div className="canvas-stage" style={{ "--receipt-preview-width": `${Math.round(450 * previewZoom / 100)}px` } as CSSProperties}
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
          if (event.target.closest(".receipt-block-hit, .receipt-inline, .block-drag-grip, .receipt-insertion-point button, .receipt-add-control, .agent-activity, .agent-cursor, .canvas-title")) return;
          setSelectedId(undefined);
        }}>
          <div className="canvas-title">
            <input aria-label="Receipt title" value={state.document.title} onChange={(event) => { if (event.target.value) apply([{ type: "setTitle", title: event.target.value }]); }} />
          </div>
          <ReceiptCanvas
            rendered={rendered}
            blocks={state.document.blocks}
            selectedId={selectedId}
            recentAgentBlockIds={editorActivity?.blockIds}
            agentActivity={editorActivity}
            onUndo={editorActivity?.phase === "complete" ? undo : undefined}
            onSelect={selectBlock}
            onReplace={replace}
            onMove={move}
            onAdd={add}
            onBrowseCatalog={(index) => openLibrary(index)}
            onOpenAddMenu={() => { setInspectorOpen(true); setInspectorMode("library"); }}
          />
          {insertNotice && !editorActivity && <div className="agent-activity insert-activity" role="status"><span>{insertNotice}</span><button type="button" onClick={() => { undo(); setInsertNotice(""); }}>Undo</button></div>}
        </div>
      </section>
      <Inspector block={selected} canRemove={state.document.blocks.length > 1} mode={inspectorMode} favoriteIds={blockLibraryPreferences.favoriteIds} recommendedIds={recommendedIds} catalogBusy={catalogBusy} catalogError={catalogError} onReconfigureCatalog={reconfigureCatalog} page={state.document.page} settings={settings} documentTitle={state.document.title} onModeChange={setInspectorMode} onChange={replace} onTitleChange={(title) => { if (title) apply([{ type: "setTitle", title }]); }} onRemove={remove} onBrowseLibrary={() => openLibrary()} onInsertFavorite={(id) => addFavorite(id)} onRefreshCatalog={refreshCatalog} onPageChange={(page) => apply([{ type: "setPage", page }])} onSettingsChange={updateSettings} onPersonalize={openPersonalization} onDismissWelcome={dismissWelcome} showWelcome={showWelcome} />
    </div>
    </div>
    </div>

    <MobileFormatBar block={selected} onChange={replace} />
    {formatSheetPresent && formatSheetBlock && <InspectorSheet
      open={formatSheetOpen}
      block={formatSheetBlock}
      canRemove={state.document.blocks.length > 1}
      catalogBusy={catalogBusy}
      catalogError={catalogError}
      settings={settings}
      onChange={replace}
      onRemove={remove}
      onRefreshCatalog={refreshCatalog}
      onReconfigureCatalog={reconfigureCatalog}
      onClose={() => setSelectedId(undefined)}
    />}
    <div className="visually-hidden" role="status" aria-live="polite">{editorActivity?.message}</div>

    {templatesOpen && <TemplatesModal store={draftStore} seed={documentSeed(settings.printerProfile)} onClose={() => setTemplatesOpen(false)} onLoad={(id) => { openTemplate(id); setTemplatesOpen(false); }} onDelete={removeTemplate} />}
    {personalizationOpen && <PersonalizationFlow profile={settings.printerProfile} onComplete={completePersonalization} onClose={closePersonalization} />}
    {library && <BlockLibraryModal defaults={defaults} width={state.document.page.printableWidthDots} favoriteIds={blockLibraryPreferences.favoriteIds} initialId={library.initialId} onToggleFavorite={toggleBlockFavorite} onInsert={(kind, config) => insertCatalog(kind, config, library.index)} onClose={() => setLibrary(undefined)} />}
  </main>;
}
