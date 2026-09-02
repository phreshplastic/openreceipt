import { useMemo, useState } from "react";
import { createDefaultDocument, createReceiptState, ReceiptController } from "../receipt";
import { documentSeed } from "../onboarding/profile";
import { loadReceipt, loadSettings } from "../state/storage";
import { createDemoAgentBackend, useWebMcpRegistration } from "./demo";

/**
 * The landing page is where an agent arrives first, so the tools have to be there
 * and not only inside /app. The receipt lives in the same browser storage the demo
 * editor reads, so a draft made from here is already on screen when open_receipt_editor
 * takes the person to the editor.
 */
export default function PublicAgentTools() {
  const [controller] = useState(() => new ReceiptController(loadReceipt(createReceiptState(createDefaultDocument(documentSeed(loadSettings().printerProfile))))));
  const backend = useMemo(() => createDemoAgentBackend({
    controller,
    openEditor: () => window.location.assign("/app"),
    focusPreview: () => window.location.assign("/app"),
  }), [controller]);
  useWebMcpRegistration(backend);
  return null;
}
