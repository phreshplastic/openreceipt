import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ApprovalModal } from "./components/Overlays";
import { getCapabilities, submitPrintJob, waitForPrintJob, type PaperProfile } from "./bridge/client";
import { applyReceiptOperations, createReceiptState, createDefaultDocument, createFromTemplate, rasterizeReceipt, renderReceiptSvg, replaceReceiptFromTemplate, type ReceiptDocumentV1, type ReceiptOperation, type ReceiptState } from "./receipt";
import { EditorPage } from "./pages/EditorPage";
import { LandingPage } from "./pages/LandingPage";
import { SetupPage } from "./pages/SetupPage";
import { decideAgentPrint } from "./state/permissions";
import { loadReceipt, loadSettings, saveReceipt, saveSettings, type AppSettings } from "./state/storage";
import { registerWebMcpTools } from "./webmcp/register";

type ApprovalRequest = { title: string; resolve(approved: boolean): void };

function AppContent() {
  const location = useLocation();
  const [receipt, setReceipt] = useState(() => loadReceipt(createReceiptState(createDefaultDocument())));
  const [settings, setSettings] = useState(loadSettings);
  const [approval, setApproval] = useState<ApprovalRequest>();
  const [printStatus, setPrintStatus] = useState("");
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [webMcpAvailable, setWebMcpAvailable] = useState(false);
  const receiptRef = useRef(receipt);
  const settingsRef = useRef(settings);

  const commitReceipt = useCallback((next: ReceiptState) => { receiptRef.current = next; setReceipt(next); saveReceipt(next); return next; }, []);
  const commitSettings = useCallback((next: AppSettings) => { settingsRef.current = next; setSettings(next); saveSettings(next); }, []);
  const applyOperations = useCallback((expectedRevision: number, operations: ReceiptOperation[]) => commitReceipt(applyReceiptOperations(receiptRef.current, expectedRevision, operations)), [commitReceipt]);
  const loadTemplate = useCallback((templateId: string, expectedRevision = receiptRef.current.revision) => {
    if (expectedRevision !== receiptRef.current.revision) throw new Error(`Receipt revision ${expectedRevision} is stale.`);
    const { template, document } = createFromTemplate(templateId);
    return commitReceipt(replaceReceiptFromTemplate(receiptRef.current, document, template.id, template.revision));
  }, [commitReceipt]);

  const sendDocument = useCallback(async (document: ReceiptDocumentV1) => {
    setPrintStatus("Rendering…");
    const rendered = renderReceiptSvg(document);
    const raster = await rasterizeReceipt(rendered);
    setPrintStatus("Queued locally…");
    const queued = await submitPrintJob(document, rendered, raster);
    const complete = await waitForPrintJob(queued.id);
    if (complete.status === "succeeded") setPrintStatus("Printed");
    else if (complete.status === "unknown") setPrintStatus("Printer response unknown — check the paper");
    else if (complete.status === "failed") setPrintStatus(complete.error || "Print failed");
    else setPrintStatus("Still printing…");
    return complete;
  }, []);

  const printCurrent = useCallback(async () => { try { await sendDocument(receiptRef.current.document); } catch (error) { setPrintStatus(error instanceof Error ? error.message : "Print failed"); throw error; } }, [sendDocument]);
  const requestAgentPrint = useCallback(async () => {
    if (decideAgentPrint(settingsRef.current, receiptRef.current) === "confirm") {
      const approved = await new Promise<boolean>((resolve) => setApproval({ title: receiptRef.current.document.title, resolve }));
      if (!approved) return { status: "rejected", message: "The user did not approve this print." };
    }
    return printCurrent();
  }, [printCurrent]);

  useEffect(() => {
    if (location.pathname !== "/app") {
      return;
    }
    const registration = registerWebMcpTools({
      getState: () => receiptRef.current,
      applyOperations,
      loadTemplate: (templateId, expectedRevision) => loadTemplate(templateId, expectedRevision),
      preview: () => {
        const rendered = renderReceiptSvg(receiptRef.current.document);
        document.getElementById("receipt-preview")?.scrollIntoView({ block: "center" });
        return { revision: receiptRef.current.revision, width: rendered.width, height: rendered.height, blockCount: receiptRef.current.document.blocks.length };
      },
      requestPrint: requestAgentPrint,
    });
    setWebMcpAvailable(registration.available);
    return registration.dispose;
  }, [applyOperations, loadTemplate, location.pathname, requestAgentPrint]);

  useEffect(() => {
    const controller = new AbortController();
    getCapabilities(controller.signal).then((value) => setBridgeOnline(value.connected)).catch(() => setBridgeOnline(false));
    return () => controller.abort();
  }, []);

  const completeSetup = (profile: PaperProfile) => {
    commitSettings({ ...settingsRef.current, configured: true, printPolicy: "confirm" });
    applyOperations(receiptRef.current.revision, [{ type: "setPage", page: { paperWidthMm: profile.paperWidthMm, printableWidthDots: profile.printableWidthDots, paddingDots: profile.paddingDots } }]);
    setBridgeOnline(true);
  };

  const testPrint = async (profile: PaperProfile) => {
    const document = createDefaultDocument();
    document.title = "Printer connection";
    document.page = { paperWidthMm: profile.paperWidthMm, printableWidthDots: profile.printableWidthDots, paddingDots: profile.paddingDots };
    document.blocks = [
      { id: crypto.randomUUID(), type: "heading", text: "CONNECTION GOOD", level: "display", align: "left" },
      { id: crypto.randomUUID(), type: "text", text: `${profile.paperWidthMm} mm · ${profile.printableWidthDots} dots`, size: "body", weight: "regular", align: "left" },
      { id: crypto.randomUUID(), type: "divider", style: "dashed" },
      { id: crypto.randomUUID(), type: "text", text: "Pete’s Printer is ready.", size: "small", weight: "medium", align: "left" },
    ];
    await sendDocument(document);
  };

  return <><Routes>
    <Route path="/" element={<LandingPage configured={settings.configured} />} />
    <Route path="/setup" element={<SetupPage onComplete={completeSetup} onTestPrint={testPrint} />} />
    <Route path="/app" element={<EditorPage state={receipt} settings={settings} webMcpAvailable={webMcpAvailable} printStatus={printStatus} bridgeOnline={bridgeOnline} applyOperations={applyOperations} loadTemplate={loadTemplate} updateSettings={commitSettings} print={printCurrent} />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>{approval && <ApprovalModal title={approval.title} onApprove={() => { approval.resolve(true); setApproval(undefined); }} onReject={() => { approval.resolve(false); setApproval(undefined); }} />}</>;
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
