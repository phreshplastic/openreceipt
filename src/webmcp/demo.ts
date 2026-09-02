import { useEffect, useRef, useState } from "react";
import type { AgentActivity, AgentAppStatus, AgentBackend } from "../agent";
import type { PrintApprovalDecision, PrintResult, PrintSnapshot } from "../printing/coordinator";
import type { ReceiptController, ReceiptDocument, ReceiptState } from "../receipt";
import { saveReceipt } from "../state/storage";
import { registerWebMcpTools } from "./register";

/** Returned after the person approves a demo print. Honest: no paper left the building. */
export const demoPrintSucceededMessage =
  "Opened a demo print of this receipt in a new tab. Nothing was sent to a printer. This browser demo has no TM-L90 attached.";

export type DemoBackendOptions = {
  controller: ReceiptController;
  /** How a new state reaches React. The default only persists it. */
  publish?(next: ReceiptState): ReceiptState;
  onActivity?(activity: AgentActivity): void;
  hasPendingApproval?(): boolean;
  requestApproval?(snapshot: PrintSnapshot, reason: string | undefined, signal: AbortSignal): Promise<PrintApprovalDecision>;
  openEditor?(): void;
  focusPreview?(): void;
};

export function createDemoAgentBackend({ controller, publish, onActivity, hasPendingApproval, requestApproval, openEditor, focusPreview }: DemoBackendOptions): AgentBackend {
  const commitState = (next: ReceiptState) => {
    saveReceipt(next);
    return publish ? publish(next) : next;
  };
  const status = (): AgentAppStatus => ({
    editorUrl: `${window.location.origin}/app`,
    configured: false,
    bridgeOnline: false,
    printPolicy: "confirm",
    syncStatus: "demo",
  });

  return {
    getState: () => controller.state,
    commit: (expectedRevision: number, document: ReceiptDocument) => commitState(controller.commitPrepared(expectedRevision, document)),
    undo: () => (controller.history.canUndo ? commitState(controller.undo()) : undefined),
    status,
    onActivity,
    focusPreview,
    openEditor,
    async requestPrint(expectedRevision: number, reason?: string, signal?: AbortSignal): Promise<PrintResult> {
      const current = controller.state;
      if (current.revision !== expectedRevision) {
        return { status: "stale", revision: expectedRevision, message: `Receipt revision ${expectedRevision} is stale; the receipt is now at revision ${current.revision}. Read it again before printing.` };
      }
      if (hasPendingApproval?.()) {
        return { status: "busy", revision: current.revision, message: "Another receipt is already waiting for approval or printing." };
      }
      if (!requestApproval) {
        openEditor?.();
        return {
          status: "cancelled",
          revision: current.revision,
          message: "Print approval happens in the editor. Open /app, then call request_receipt_print again. This browser demo has no TM-L90 attached.",
        };
      }
      const snapshot: PrintSnapshot = { revision: current.revision, document: structuredClone(current.document) };
      const abortSignal = signal ?? new AbortController().signal;
      const decision = await requestApproval(snapshot, reason, abortSignal);
      if (decision === "reject") {
        return { status: "rejected", revision: snapshot.revision, message: "The user kept the receipt as a draft." };
      }
      if (decision === "stale") {
        return { status: "stale", revision: snapshot.revision, message: "The receipt changed while approval was open. Nothing was printed." };
      }
      if (controller.state.revision !== snapshot.revision) {
        return { status: "stale", revision: snapshot.revision, message: "The receipt changed before printing. Nothing was printed." };
      }
      onActivity?.({ phase: "printing", message: "Opening a demo print…" });
      return { status: "succeeded", revision: snapshot.revision, message: demoPrintSucceededMessage };
    },
  };
}

/** Registers the toolset for the life of the component and reports whether a host took it. */
export function useWebMcpRegistration(backend: AgentBackend) {
  const [available, setAvailable] = useState(false);
  const backendRef = useRef(backend);
  useEffect(() => { backendRef.current = backend; }, [backend]);

  useEffect(() => {
    // The backend closes over refs and a controller instance, so one registration
    // survives every re-render; re-registering per keystroke would churn the host.
    const stable: AgentBackend = {
      getState: (signal) => backendRef.current.getState(signal),
      commit: (revision, document, summary, signal) => backendRef.current.commit(revision, document, summary, signal),
      requestPrint: (revision, reason, signal) => backendRef.current.requestPrint(revision, reason, signal),
      status: (signal) => backendRef.current.status(signal),
      undo: () => backendRef.current.undo?.(),
      focusPreview: () => backendRef.current.focusPreview?.(),
      openEditor: (highlight) => backendRef.current.openEditor?.(highlight),
      onActivity: (activity) => backendRef.current.onActivity?.(activity),
    };
    const registration = registerWebMcpTools(stable);
    let disposed = false;
    void registration.ready.then((ready) => { if (!disposed) setAvailable(ready); });
    return () => { disposed = true; registration.dispose(); };
  }, []);

  return available;
}
