import { useEffect, useState } from "react";
import { ArrowRight, Check, FileText, Printer, RefreshCw, Usb, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { getCapabilities, saveConfiguration, type BridgeCapabilities, type PaperProfile, type PrinterAdapter } from "../bridge/client";

type Props = {
  onComplete(profile: PaperProfile): Promise<void>;
  onTestPrint(profile: PaperProfile): Promise<void>;
  intent?: "standalone" | "print";
  onCancel?(): void;
};

const fallbackProfile = { id: "80mm-576", label: "80 mm · 576 dots", paperWidthMm: 80, printableWidthDots: 576, paddingDots: 28 } as PaperProfile;

export function SetupPage({ onComplete, onTestPrint, intent = "standalone", onCancel }: Props) {
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<BridgeCapabilities>();
  const [adapter, setAdapter] = useState<PrinterAdapter>("epson-tm-l90-usb");
  const [profileId, setProfileId] = useState<PaperProfile["id"]>("80mm-576");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const connected = Boolean(capabilities?.connected);
  const bridgeUnreachable = !loading && capabilities === undefined;
  const profile = capabilities?.profiles.find((item) => item.id === profileId) ?? fallbackProfile;

  const probe = (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    setMessage("");
    getCapabilities(signal).then((result) => {
      setCapabilities(result);
      setAdapter(result.adapter === "virtual" ? "virtual" : "epson-tm-l90-usb");
      setProfileId((result.configuredProfileId as PaperProfile["id"]) || "80mm-576");
    }).catch((error: unknown) => {
      if (signal?.aborted) return;
      setCapabilities(undefined);
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "The local bridge could not be reached.");
    }).finally(() => { if (!signal?.aborted) setLoading(false); });
  };

  useEffect(() => {
    const controller = new AbortController();
    getCapabilities(controller.signal).then((result) => {
      setCapabilities(result);
      setAdapter(result.adapter === "virtual" ? "virtual" : "epson-tm-l90-usb");
      setProfileId((result.configuredProfileId as PaperProfile["id"]) || "80mm-576");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setCapabilities(undefined);
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "The local bridge could not be reached.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const cancel = () => onCancel ? onCancel() : navigate("/app");
  const configure = async () => {
    setBusy(true);
    setMessage("");
    try {
      await saveConfiguration(profileId, adapter);
      await onComplete(profile);
      if (intent === "standalone") navigate("/app");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Setup failed.");
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    setFailed(false);
    setMessage("Sending a test print…");
    try {
      await saveConfiguration(profileId, adapter);
      await onTestPrint(profile);
      setMessage(adapter === "virtual" ? "Test print written to the bridge’s file output." : "Test print sent.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "The test print failed.");
    } finally { setBusy(false); }
  };

  const content = <>
    <header className="setup-top">
      <Brand compact />
      <span className="setup-step-count">Printer setup</span>
      {intent === "print" && <button type="button" className="icon-button setup-close" onClick={cancel} aria-label="Keep editing"><X size={17} /></button>}
    </header>
    <section className="setup-card">
      <div className="setup-step">
        <h1>Connect your printer</h1>
        <p className="setup-intro">Choose the printer and paper you have connected. OpenReceipt will match the receipt to that paper width.</p>
        <div className="setup-section-label">Printer</div>
        <div className="setup-list setup-paper-list" role="group" aria-label="Printer">
          <button type="button" className={adapter === "epson-tm-l90-usb" ? "selected" : ""} aria-pressed={adapter === "epson-tm-l90-usb"} onClick={() => setAdapter("epson-tm-l90-usb")}>
            <span className="setup-row-mark"><Usb size={17} /></span><span className="setup-row-copy"><strong>Epson TM-L90</strong><small>{loading ? "Looking for the bridge…" : capabilities === undefined ? "Bridge unavailable" : connected ? "Detected on USB" : capabilities.detail || "Printer not detected"}</small></span>{adapter === "epson-tm-l90-usb" && <Check size={16} className="setup-check" />}
          </button>
          <button type="button" className={adapter === "virtual" ? "selected" : ""} aria-pressed={adapter === "virtual"} onClick={() => setAdapter("virtual")} disabled={bridgeUnreachable}>
            <span className="setup-row-mark"><FileText size={17} /></span><span className="setup-row-copy"><strong>Virtual printer</strong><small>Prints to a file on this machine — no hardware needed.</small></span>{adapter === "virtual" && <Check size={16} className="setup-check" />}
          </button>
        </div>
        {bridgeUnreachable && <div className="setup-message error">{message || "Start the local bridge, then try again."}<button className="text-button" onClick={() => probe()} disabled={loading}><RefreshCw size={14} className={loading ? "spinning" : ""} />Try again</button></div>}
        <div className="setup-section-label setup-paper-label">Paper width</div>
        <div className="setup-list setup-paper-list" role="group" aria-label="Paper size">
          {(capabilities?.profiles ?? [fallbackProfile]).map((item) => <button type="button" key={item.id} className={profileId === item.id ? "selected" : ""} aria-pressed={profileId === item.id} onClick={() => setProfileId(item.id)}><span className={`paper-chip paper-${item.paperWidthMm}`} /><span className="setup-row-copy"><strong>{item.paperWidthMm} mm</strong><small>{item.printableWidthDots} printable dots</small></span>{profileId === item.id && <Check size={16} className="setup-check" />}</button>)}
        </div>
        <button className="button secondary setup-test" onClick={() => void test()} disabled={busy || capabilities === undefined}><Printer size={15} />{busy ? "Printing…" : "Test connection"}</button>
        {message && !bridgeUnreachable && <div className={`setup-message ${failed ? "error" : ""}`}>{message}</div>}
      </div>
      <footer className="setup-actions">
        <button className="text-button" onClick={cancel}>{intent === "print" ? "Keep editing" : "Explore without setup"}</button>
        <button className="button primary" onClick={() => void configure()} disabled={busy || loading || capabilities === undefined || (adapter === "epson-tm-l90-usb" && !connected)}>{intent === "print" ? "Save and print" : "Finish setup"}<ArrowRight size={16} /></button>
      </footer>
    </section>
  </>;

  return intent === "print" ? <div className="setup-overlay" role="dialog" aria-modal="true" aria-label="Printer setup"><main className="setup-page setup-page-embedded">{content}</main></div> : <main className="setup-page">{content}</main>;
}
