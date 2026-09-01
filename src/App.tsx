import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ApprovalPanel, ReceiptConflictPanel } from "./components/Overlays";
import { decidePrintRequest, ensureBrowserSession, getCanonicalSettings, getCapabilities, listPrintRequests, submitPrintJob, submitPrintRequest, updateCanonicalSettings, waitForPrintJob, type PaperProfile, type PrintJob } from "./bridge/client";
import { loadBlockLibraryPreferences, prepareReceiptCommands, saveBlockLibraryPreferences, toggleFavorite as toggleBlockFavorite, type BlockLibraryPreferences, type ReceiptCommand } from "./block-library";
import { createReceiptState, createDefaultDocument, createFromTemplate, rasterizeReceipt, ReceiptController, renderReceiptSvg, type ReceiptDocument, type ReceiptOperation, type ReceiptState } from "./receipt";
import { PrintCoordinator, type PrintApprovalDecision, type PrintResult, type PrintSnapshot } from "./printing/coordinator";
import { EditorPage } from "./pages/EditorPage";
import { BlocksPage } from "./pages/BlocksPage";
import { ChartLabPage } from "./pages/ChartLabPage";
import { LandingPage } from "./pages/LandingPage";
import { SetupPage } from "./pages/SetupPage";
import { decideAgentPrint } from "./state/permissions";
import { acceptSharedSettings, loadReceipt, loadSettings, saveReceipt, saveSettings, shareableSettings, type AppSettings } from "./state/storage";
import { ReceiptSession, type ReceiptConflict, type ReceiptSyncStatus } from "./state/receiptSession";
import { registerWebMcpTools, type AgentActivity, type AgentAppStatus, type AgentBackend } from "./webmcp/register";

type ApprovalRequest = {
  snapshot: PrintSnapshot;
  reason?: string;
  width: number;
  height: number;
  policy: AppSettings["printPolicy"];
  resolve(decision: PrintApprovalDecision): void;
};
export type PrintStage = "idle" | "rendering" | "feeding" | "complete" | "failed" | "unknown";
export type EditorActivity = AgentActivity & { id: number; blockIds: string[] };

function AppContent() {
  const navigate = useNavigate();
  const [receiptController] = useState(() => new ReceiptController(loadReceipt(createReceiptState(createDefaultDocument()))));
  const [receipt, setReceipt] = useState(() => receiptController.state);
  const [settings, setSettings] = useState(loadSettings);
  const [blockLibraryPreferences, setBlockLibraryPreferences] = useState(loadBlockLibraryPreferences);
  const [approval, setApproval] = useState<ApprovalRequest>();
  const [printStatus, setPrintStatus] = useState("");
  const [printStage, setPrintStage] = useState<PrintStage>("idle");
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [webMcpAvailable, setWebMcpAvailable] = useState(false);
  const [editorActivity, setEditorActivity] = useState<EditorActivity>();
  const [syncStatus, setSyncStatus] = useState<ReceiptSyncStatus>("connecting");
  const [receiptConflict, setReceiptConflict] = useState<ReceiptConflict>();
  const [externalApproval, setExternalApproval] = useState<PrintJob>();
  const receiptRef = useRef(receipt);
  const settingsRef = useRef(settings);
  const approvalRef = useRef<ApprovalRequest | undefined>(undefined);
  const printCoordinatorRef = useRef<PrintCoordinator | undefined>(undefined);
  const activityTimer = useRef<number | undefined>(undefined);
  const receiptSessionRef = useRef<ReceiptSession | undefined>(undefined);
  const externalApprovalRef = useRef<PrintJob | undefined>(undefined);
  const settingsRevisionRef = useRef(0);

  const publishReceipt = useCallback((next: ReceiptState, actor: "human" | "webmcp" = "human", summary?: string) => {
    if (approvalRef.current && approvalRef.current.snapshot.revision !== next.revision) approvalRef.current.resolve("stale");
    receiptRef.current = next;
    setReceipt(next);
    saveReceipt(next);
    if (externalApprovalRef.current?.receiptRevision !== undefined && externalApprovalRef.current.receiptRevision !== next.revision) {
      externalApprovalRef.current = undefined;
      setExternalApproval(undefined);
    }
    receiptSessionRef.current?.publish(next, { kind: actor, label: actor === "webmcp" ? "Agent" : "Browser" }, summary);
    return next;
  }, []);
  const commitSettings = useCallback(async (next: AppSettings) => {
    if (!receiptSessionRef.current?.isOnline) {
      setPrintStatus("Settings need the local API; your current policy is unchanged.");
      return;
    }
    try {
      const saved = await updateCanonicalSettings(shareableSettings(next), settingsRevisionRef.current, { kind: "human", label: "Browser" });
      settingsRevisionRef.current = saved.revision;
      const accepted = acceptSharedSettings(saved);
      settingsRef.current = accepted;
      setSettings(accepted);
      saveSettings(accepted);
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : "Settings could not be saved.");
    }
  }, []);
  const commitBlockLibraryPreferences = useCallback((next: BlockLibraryPreferences) => { setBlockLibraryPreferences(next); saveBlockLibraryPreferences(next); }, []);
  const clearActivity = useCallback(() => {
    if (activityTimer.current) window.clearTimeout(activityTimer.current);
    setEditorActivity(undefined);
  }, []);
  const announceAgentActivity = useCallback((activity: AgentActivity) => {
    if (activityTimer.current) window.clearTimeout(activityTimer.current);
    setEditorActivity({ id: Date.now(), blockIds: activity.blockIds ?? [], ...activity });
    if (activity.phase !== "waitingForApproval" && activity.phase !== "printing") {
      const duration = activity.phase === "reading" ? 1800 : 6000;
      activityTimer.current = window.setTimeout(() => setEditorActivity(undefined), duration);
    }
  }, []);
  const announceAgentChange = useCallback((blockIds: string[], message: string) => announceAgentActivity({ phase: "complete", blockIds, message }), [announceAgentActivity]);
  const refreshExternalApprovals = useCallback(async () => {
    try {
      const { items } = await listPrintRequests("awaiting_approval");
      externalApprovalRef.current = items[0];
      setExternalApproval(items[0]);
    } catch {
      externalApprovalRef.current = undefined;
      setExternalApproval(undefined);
    }
  }, []);
  const refreshCanonicalSettings = useCallback(async () => {
    try {
      await ensureBrowserSession();
      let shared = await getCanonicalSettings();
      if (!shared.initialized) {
        shared = await updateCanonicalSettings(shareableSettings(settingsRef.current), shared.revision, { kind: "human", label: "Browser migration" });
      }
      settingsRevisionRef.current = shared.revision;
      const accepted = acceptSharedSettings(shared);
      settingsRef.current = accepted;
      setSettings(accepted);
      saveSettings(accepted);
    } catch {
      // The cached policy remains visible, but it cannot be changed until the API acknowledges it.
    }
  }, []);

  useEffect(() => {
    const session = new ReceiptSession(receiptRef.current, {
      onShared: (shared, event) => {
        const next = receiptController.acceptShared(shared);
        receiptRef.current = next;
        setReceipt(next);
        saveReceipt(next);
        if (event?.actor && event.actor.kind !== "human") {
          announceAgentActivity({
            phase: "complete",
            message: event.summary || `${event.actor.label || "Agent"} updated the receipt`,
            blockIds: event.changedBlockIds ?? [],
          });
        }
      },
      onConflict: setReceiptConflict,
      onStatus: (status) => {
        setSyncStatus(status);
        if (status === "saved") void refreshCanonicalSettings();
      },
      onEvent: () => void refreshExternalApprovals(),
    });
    receiptSessionRef.current = session;
    void session.start().then(() => void refreshExternalApprovals());

    return () => {
      session.dispose();
      if (receiptSessionRef.current === session) receiptSessionRef.current = undefined;
    };
  }, [announceAgentActivity, receiptController, refreshCanonicalSettings, refreshExternalApprovals]);

  const applyOperations = useCallback((expectedRevision: number, operations: ReceiptOperation[]) => {
    clearActivity();
    return publishReceipt(receiptController.apply(expectedRevision, operations));
  }, [clearActivity, publishReceipt, receiptController]);
  const applyCommands = useCallback(async (expectedRevision: number, commands: ReceiptCommand[], source: "human" | "agent" = "human") => {
    const before = receiptRef.current;
    const document = await prepareReceiptCommands(before, expectedRevision, commands);
    const next = publishReceipt(receiptController.commitPrepared(expectedRevision, document), source === "agent" ? "webmcp" : "human", source === "agent" ? "Agent edited the receipt" : undefined);
    if (source === "agent") {
      const previous = new Map(before.document.blocks.map((block) => [block.id, JSON.stringify(block)]));
      const blockIds = next.document.blocks.filter((block) => previous.get(block.id) !== JSON.stringify(block)).map((block) => block.id);
      announceAgentChange(blockIds, `Agent updated ${blockIds.length || "the receipt"}${blockIds.length ? ` block${blockIds.length === 1 ? "" : "s"}` : ""}`);
    } else clearActivity();
    return next;
  }, [announceAgentChange, clearActivity, publishReceipt, receiptController]);
  const loadTemplateWithSource = useCallback((templateId: string, expectedRevision: number, source: "human" | "agent") => {
    const { template, document } = createFromTemplate(templateId);
    const next = publishReceipt(receiptController.loadTemplate(expectedRevision, document, template.id, template.revision), source === "agent" ? "webmcp" : "human", `${source === "agent" ? "Agent" : "Browser"} loaded ${template.name}`);
    if (source === "agent") announceAgentChange(next.document.blocks.map((block) => block.id), `Agent loaded ${template.name}`);
    else clearActivity();
    return next;
  }, [announceAgentChange, clearActivity, publishReceipt, receiptController]);
  const agentCommit = useCallback((expectedRevision: number, document: ReceiptDocument, summary: string) =>
    publishReceipt(receiptController.commitPrepared(expectedRevision, document), "webmcp", summary), [publishReceipt, receiptController]);
  const agentUndo = useCallback(() => {
    if (!receiptController.history.canUndo) return undefined;
    return publishReceipt(receiptController.undo(), "webmcp", "The agent undid its last change");
  }, [publishReceipt, receiptController]);
  const loadTemplate = useCallback((templateId: string, expectedRevision = receiptRef.current.revision) => loadTemplateWithSource(templateId, expectedRevision, "human"), [loadTemplateWithSource]);
  const undo = useCallback(() => { clearActivity(); return publishReceipt(receiptController.undo()); }, [clearActivity, publishReceipt, receiptController]);
  const redo = useCallback(() => { clearActivity(); return publishReceipt(receiptController.redo()); }, [clearActivity, publishReceipt, receiptController]);

  const sendDocument = useCallback(async (snapshot: PrintSnapshot, requester: "human" | "webmcp", reason?: string, signal?: AbortSignal) => {
    setPrintStage("rendering");
    setPrintStatus("Rendering…");
    const rendered = renderReceiptSvg(snapshot.document);
    const raster = await rasterizeReceipt(rendered);
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    setPrintStage("feeding");
    setPrintStatus("Sending to printer…");
    let queued = await submitPrintRequest(snapshot, rendered, raster, { kind: requester, label: requester === "webmcp" ? "Agent" : "Browser" }, reason, crypto.randomUUID(), signal);
    if (queued.status === "awaiting_approval") {
      queued = await decidePrintRequest(queued.id, "approve", { kind: "human", label: "Browser" }, signal);
    }
    setPrintStatus("Printing…");
    const complete = await waitForPrintJob(queued.id, 30_000, signal);
    if (complete.status === "succeeded") {
      setPrintStage("complete");
      setPrintStatus("Printed");
      return { status: "succeeded", jobId: complete.id, checksum: complete.checksum, message: "The receipt printed successfully." } as const;
    }
    if (complete.status === "failed") {
      const message = complete.error || "Print failed";
      setPrintStage("failed");
      setPrintStatus(message);
      return { status: "failed", jobId: complete.id, checksum: complete.checksum, message } as const;
    }
    const message = complete.status === "unknown" ? "Printer response unknown — check the paper before retrying." : "The print is still in progress — check the paper before retrying.";
    setPrintStage("unknown");
    setPrintStatus(message);
    return { status: "unknown", jobId: complete.id, checksum: complete.checksum, message } as const;
  }, []);

  useEffect(() => {
    const coordinator = new PrintCoordinator({
      getCurrentRevision: () => receiptRef.current.revision,
      requestApproval: (snapshot, reason, signal) => new Promise<PrintApprovalDecision>((resolve) => {
        const rendered = renderReceiptSvg(snapshot.document);
        let settled = false;
        const request: ApprovalRequest = {
          snapshot,
          reason,
          width: rendered.width,
          height: rendered.height,
          policy: settingsRef.current.printPolicy,
          resolve: (decision) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener("abort", abort);
            if (approvalRef.current === request) {
              approvalRef.current = undefined;
              setApproval(undefined);
            }
            resolve(decision);
          },
        };
        const abort = () => request.resolve("reject");
        signal.addEventListener("abort", abort, { once: true });
        approvalRef.current = request;
        setApproval(request);
      }),
      execute: async (snapshot, signal, request) => {
        announceAgentActivity({ phase: "printing", message: "The agent is printing the approved receipt", blockIds: snapshot.document.blocks.map((block) => block.id) });
        return sendDocument(snapshot, request.requester ?? "human", request.reason, signal);
      },
    });
    printCoordinatorRef.current = coordinator;
    return () => {
      coordinator.cancel("Print coordination ended.");
      if (printCoordinatorRef.current === coordinator) printCoordinatorRef.current = undefined;
    };
  }, [announceAgentActivity, sendDocument]);

  const runPrintRequest = useCallback(async (snapshot: PrintSnapshot, requiresApproval: boolean, reason?: string, signal?: AbortSignal, requester: "human" | "webmcp" = "human") => {
    const coordinator = printCoordinatorRef.current;
    if (!coordinator) return { status: "failed", revision: snapshot.revision, message: "Printing is not ready yet." } as PrintResult;
    const result = await coordinator.request({ snapshot, requiresApproval, reason, signal, requester });
    if (result.status === "failed") { setPrintStage("failed"); setPrintStatus(result.message); }
    if (result.status === "cancelled" || result.status === "rejected" || result.status === "stale" || result.status === "busy") {
      setPrintStage("idle");
      setPrintStatus(result.message);
    }
    return result;
  }, []);
  const printCurrent = useCallback(async () => {
    const current = receiptRef.current;
    return runPrintRequest({ revision: current.revision, document: structuredClone(current.document) }, false);
  }, [runPrintRequest]);
  const refreshBridge = useCallback(async (silent = false) => {
    if (!silent) { setPrintStage("idle"); setPrintStatus("Checking printer…"); }
    const controller = new AbortController();
    try {
      const capabilities = await getCapabilities(controller.signal);
      setBridgeOnline(capabilities.connected);
      if (!silent) setPrintStatus(capabilities.connected ? "" : "Printer bridge is offline");
      return capabilities.connected;
    } catch {
      setBridgeOnline(false);
      if (!silent) setPrintStatus("Printer bridge is unavailable");
      return false;
    }
  }, []);
  const requestAgentPrint = useCallback(async (expectedRevision: number, reason: string | undefined, signal?: AbortSignal): Promise<PrintResult> => {
    const current = receiptRef.current;
    if (current.revision !== expectedRevision) {
      return { status: "stale", revision: expectedRevision, message: `Receipt revision ${expectedRevision} is stale; current revision is ${current.revision}.` };
    }
    const snapshot = { revision: current.revision, document: structuredClone(current.document) };
    return runPrintRequest(snapshot, decideAgentPrint(settingsRef.current, current) === "confirm", reason, signal, "webmcp");
  }, [runPrintRequest]);

  // The status an agent can read is volatile; keep it behind a ref so a sync tick never
  // tears down and re-registers the whole toolset.
  const agentStatusRef = useRef<AgentAppStatus>({ editorUrl: "/app", configured: false, bridgeOnline: false, printPolicy: "confirm" });
  useEffect(() => {
    agentStatusRef.current = {
      editorUrl: `${window.location.origin}/app`,
      configured: settings.configured,
      bridgeOnline,
      printPolicy: settings.printPolicy,
      syncStatus,
      lastPrint: printStatus ? { status: printStage, message: printStatus } : undefined,
    };
  }, [bridgeOnline, printStage, printStatus, settings.configured, settings.printPolicy, syncStatus]);

  useEffect(() => {
    const backend: AgentBackend = {
      getState: () => receiptRef.current,
      commit: agentCommit,
      requestPrint: requestAgentPrint,
      status: () => agentStatusRef.current,
      undo: agentUndo,
      focusPreview: () => {
        navigate("/app");
        window.requestAnimationFrame(() => document.getElementById("receipt-preview")?.scrollIntoView({ block: "center" }));
      },
      openEditor: () => navigate("/app"),
      onActivity: announceAgentActivity,
    };
    const registration = registerWebMcpTools(backend);
    let disposed = false;
    void registration.ready.then((ready) => { if (!disposed) setWebMcpAvailable(ready); });
    return () => {
      disposed = true;
      registration.dispose();
      printCoordinatorRef.current?.cancel("The editor was closed.");
    };
  }, [agentCommit, agentUndo, announceAgentActivity, navigate, requestAgentPrint]);

  useEffect(() => {
    const controller = new AbortController();
    getCapabilities(controller.signal).then((value) => setBridgeOnline(value.connected)).catch(() => setBridgeOnline(false));
    return () => controller.abort();
  }, []);

  const completeSetup = async (profile: PaperProfile, defaults: { location: string; unit: "fahrenheit" | "celsius" }) => {
    await commitSettings({ ...settingsRef.current, configured: true, printPolicy: "confirm", defaultLocation: defaults.location.trim(), defaultUnit: defaults.unit });
    applyOperations(receiptRef.current.revision, [{ type: "setPage", page: { paperWidthMm: profile.paperWidthMm, printableWidthDots: profile.printableWidthDots, paddingDots: profile.paddingDots } }]);
    setBridgeOnline(true);
  };

  const testPrint = async (profile: PaperProfile) => {
    const document = createDefaultDocument();
    document.title = "Printer connection";
    document.page = { paperWidthMm: profile.paperWidthMm, printableWidthDots: profile.printableWidthDots, paddingDots: profile.paddingDots };
    document.blocks = [
      { id: crypto.randomUUID(), type: "heading", text: "CONNECTION GOOD", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
      { id: crypto.randomUUID(), type: "text", text: `${profile.paperWidthMm} mm · ${profile.printableWidthDots} dots`, size: "body", weight: "regular", italic: false, underline: false, align: "left" },
      { id: crypto.randomUUID(), type: "divider", style: "dashed" },
      { id: crypto.randomUUID(), type: "text", text: "Pete’s Printer is ready.", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
      { id: crypto.randomUUID(), type: "divider", style: "solid" },
      { id: crypto.randomUUID(), type: "text", text: "READY TO MAKE SOMETHING", size: "small", weight: "medium", italic: false, underline: false, align: "center" },
    ];
    const rendered = renderReceiptSvg(document);
    const raster = await rasterizeReceipt(rendered);
    const queued = await submitPrintJob(document, rendered, raster, crypto.randomUUID());
    const complete = await waitForPrintJob(queued.id);
    if (complete.status !== "succeeded") throw new Error(complete.error || "The connection slip did not print.");
  };

  const decideExternalApproval = async (decision: "approve" | "reject") => {
    if (!externalApproval) return;
    try {
      await decidePrintRequest(externalApproval.id, decision, { kind: "human", label: "Browser" });
      externalApprovalRef.current = undefined;
      setExternalApproval(undefined);
      if (decision === "approve") {
        setPrintStage("feeding");
        setPrintStatus("Printing approved request…");
        const complete = await waitForPrintJob(externalApproval.id);
        setPrintStage(complete.status === "succeeded" ? "complete" : complete.status === "failed" ? "failed" : "unknown");
        setPrintStatus(complete.status === "succeeded" ? "Printed" : complete.error || "Check the printer before retrying.");
      }
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : "The print request could not be decided.");
      await refreshExternalApprovals();
    }
  };

  return <><Routes>
    <Route path="/" element={<LandingPage configured={settings.configured} />} />
    <Route path="/setup" element={<SetupPage defaults={{ location: settings.defaultLocation, unit: settings.defaultUnit }} onComplete={completeSetup} onTestPrint={testPrint} />} />
    <Route path="/app" element={<EditorPage state={receipt} settings={settings} blockLibraryPreferences={blockLibraryPreferences} webMcpAvailable={webMcpAvailable} printStatus={printStatus} printStage={printStage} bridgeOnline={bridgeOnline} syncStatus={syncStatus} history={receiptController.history} editorActivity={editorActivity} applyOperations={applyOperations} applyCommands={applyCommands} loadTemplate={loadTemplate} updateSettings={commitSettings} toggleBlockFavorite={(id) => commitBlockLibraryPreferences(toggleBlockFavorite(blockLibraryPreferences, id))} undo={undo} redo={redo} refreshBridge={() => refreshBridge(false)} print={printCurrent} />} />
    <Route path="/blocks" element={<BlocksPage />} />
    <Route path="/blocks/charts" element={<ChartLabPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
    {receiptConflict && <ReceiptConflictPanel local={receiptConflict.local} shared={receiptConflict.shared} onUseShared={() => void receiptSessionRef.current?.resolveConflict("shared")} onKeepLocal={() => void receiptSessionRef.current?.resolveConflict("local")} />}
    {approval && <ApprovalPanel title={approval.snapshot.document.title} reason={approval.reason} revision={approval.snapshot.revision} width={approval.width} height={approval.height} paperWidthMm={approval.snapshot.document.page.paperWidthMm} policy={approval.policy} onApprove={() => approval.resolve("approve")} onReject={() => approval.resolve("reject")} />}
    {!approval && externalApproval?.document && <ApprovalPanel title={externalApproval.document.title} reason={externalApproval.reason ?? undefined} revision={externalApproval.receiptRevision ?? 0} width={externalApproval.width ?? externalApproval.document.page.printableWidthDots} height={externalApproval.height ?? 0} paperWidthMm={externalApproval.document.page.paperWidthMm} policy={settings.printPolicy} onApprove={() => void decideExternalApproval("approve")} onReject={() => void decideExternalApproval("reject")} />}
  </>;
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
