import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorActivity, PrintStage } from "../App";
import { loadBlockLibraryPreferences, prepareReceiptCommands, saveBlockLibraryPreferences, toggleFavorite, type ReceiptCommand } from "../block-library";
import { ApprovalPanel } from "../components/Overlays";
import { createDefaultDocument, createFromTemplate, createReceiptState, ReceiptController, renderReceiptSvg, type ReceiptDocument, type ReceiptOperation, type ReceiptState } from "../receipt";
import { documentSeed } from "../onboarding/profile";
import type { PrintApprovalDecision, PrintSnapshot } from "../printing/coordinator";
import type { PrintDestination } from "../printing/destination";
import { playDemoPrint, PRINT_DONE_HOLD_MS } from "../printing/preview";
import { loadReceipt, loadSettings, saveReceipt, saveSettings, type AppSettings } from "../state/storage";
import { createDemoAgentBackend, useWebMcpRegistration } from "../webmcp/demo";
import type { AgentActivity, AgentBackend } from "../agent";
import { EditorPage } from "./EditorPage";

type ApprovalRequest = {
  snapshot: PrintSnapshot;
  reason?: string;
  width: number;
  height: number;
  resolve(decision: PrintApprovalDecision): void;
};

export default function DemoEditorPage() {
  const [settings, setSettings] = useState(loadSettings);
  const [controller] = useState(() => new ReceiptController(loadReceipt(createReceiptState(createDefaultDocument(documentSeed(settings.printerProfile))))));
  const [receipt, setReceipt] = useState(() => controller.state);
  const [preferences, setPreferences] = useState(loadBlockLibraryPreferences);
  const [activity, setActivity] = useState<EditorActivity>();
  const [approval, setApproval] = useState<ApprovalRequest>();
  const [printStage, setPrintStage] = useState<PrintStage>("idle");
  const approvalRef = useRef<ApprovalRequest | undefined>(undefined);

  const publish = useCallback((next: ReceiptState) => {
    if (approvalRef.current && approvalRef.current.snapshot.revision !== next.revision) {
      approvalRef.current.resolve("stale");
    }
    setReceipt(next);
    saveReceipt(next);
    return next;
  }, []);
  const applyOperations = useCallback((expectedRevision: number, operations: ReceiptOperation[]) => publish(controller.apply(expectedRevision, operations)), [controller, publish]);
  const applyCommands = useCallback(async (expectedRevision: number, commands: ReceiptCommand[]) => {
    const document = await prepareReceiptCommands(controller.state, expectedRevision, commands);
    return publish(controller.commitPrepared(expectedRevision, document));
  }, [controller, publish]);
  const loadDocument = useCallback((document: ReceiptDocument) => { publish(controller.commitPrepared(controller.state.revision, document)); }, [controller, publish]);
  const loadTemplate = useCallback((id: string, document?: ReceiptDocument) => {
    const created = createFromTemplate(id, documentSeed(settings.printerProfile));
    publish(controller.loadTemplate(controller.state.revision, document ?? created.document, created.template.id, created.template.revision));
  }, [controller, publish, settings.printerProfile]);
  const updateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);
  const toggleBlockFavorite = useCallback((id: Parameters<typeof toggleFavorite>[1]) => {
    setPreferences((current) => {
      const next = toggleFavorite(current, id);
      saveBlockLibraryPreferences(next);
      return next;
    });
  }, []);

  const runDemoPrint = useCallback((document: ReceiptDocument) => playDemoPrint(document, { onStage: setPrintStage }), []);

  useEffect(() => {
    if (printStage !== "complete") return;
    const timer = window.setTimeout(() => setPrintStage("idle"), PRINT_DONE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [printStage]);

  const announce = useCallback((next: AgentActivity) => setActivity({ id: Date.now(), blockIds: next.blockIds ?? [], ...next }), []);
  useEffect(() => {
    if (!activity) return;
    const persist = activity.phase === "waitingForApproval" || activity.phase === "printing" || activity.phase === "drafting" || activity.phase === "editing";
    if (persist) return;
    const timer = window.setTimeout(() => setActivity(undefined), activity.phase === "reading" ? 1800 : 5000);
    return () => window.clearTimeout(timer);
  }, [activity]);

  const requestApproval = useCallback((snapshot: PrintSnapshot, reason: string | undefined, signal: AbortSignal) => new Promise<PrintApprovalDecision>((resolve) => {
    const rendered = renderReceiptSvg(snapshot.document);
    let settled = false;
    const request: ApprovalRequest = {
      snapshot,
      reason,
      width: rendered.width,
      height: rendered.height,
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
    if (signal.aborted) {
      abort();
      return;
    }
    approvalRef.current = request;
    setApproval(request);
  }), []);

  const implRef = useRef<AgentBackend | undefined>(undefined);
  const [backend] = useState<AgentBackend>(() => ({
    getState: (signal) => implRef.current!.getState(signal),
    commit: (revision, document, summary, signal) => implRef.current!.commit(revision, document, summary, signal),
    requestPrint: (revision, reason, signal) => implRef.current!.requestPrint(revision, reason, signal),
    status: (signal) => implRef.current!.status(signal),
    undo: () => implRef.current!.undo?.(),
    onActivity: (activity) => implRef.current!.onActivity?.(activity),
    focusPreview: () => implRef.current!.focusPreview?.(),
    openEditor: (highlight) => implRef.current!.openEditor?.(highlight),
  }));
  useEffect(() => {
    implRef.current = createDemoAgentBackend({
      controller,
      publish,
      onActivity: announce,
      hasPendingApproval: () => Boolean(approvalRef.current),
      requestApproval,
      focusPreview: () => document.getElementById("receipt-preview")?.scrollIntoView({ block: "center" }),
    });
  }, [announce, controller, publish, requestApproval]);
  const webMcpAvailable = useWebMcpRegistration(backend);

  const print = useCallback(async (destination: PrintDestination = "demo") => {
    setActivity(undefined);
    if (destination !== "demo") return;
    await runDemoPrint(controller.state.document);
  }, [controller, runDemoPrint]);

  return <>
    <EditorPage
      runtimeMode="demo"
      state={receipt}
      settings={settings}
      blockLibraryPreferences={preferences}
      webMcpAvailable={webMcpAvailable}
      printStatus=""
      printStage={printStage}
      printJobs={[]}
      printerConnected={false}
      syncStatus="saved"
      history={controller.history}
      editorActivity={activity}
      applyOperations={applyOperations}
      applyCommands={applyCommands}
      loadTemplate={loadTemplate}
      loadDocument={loadDocument}
      updateSettings={updateSettings}
      toggleBlockFavorite={toggleBlockFavorite}
      undo={() => { setActivity(undefined); return publish(controller.undo()); }}
      redo={() => { setActivity(undefined); return publish(controller.redo()); }}
      refreshBridge={async () => false}
      print={print}
    />
    {approval && <ApprovalPanel
      title={approval.snapshot.document.title}
      reason={approval.reason}
      revision={approval.snapshot.revision}
      width={approval.width}
      height={approval.height}
      paperWidthMm={approval.snapshot.document.page.paperWidthMm}
      policy="confirm"
      destination="Demo print · this browser"
      approveLabel="Approve and demo print"
      onApprove={() => {
        void runDemoPrint(approval.snapshot.document);
        approval.resolve("approve");
      }}
      onReject={() => approval.resolve("reject")}
    />}
  </>;
}
