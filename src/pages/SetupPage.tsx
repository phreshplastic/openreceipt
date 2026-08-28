import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RefreshCw, Usb, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { getCapabilities, saveConfiguration, type BridgeCapabilities, type PaperProfile } from "../bridge/client";

type Props = { onComplete(profile: PaperProfile): void; onTestPrint(profile: PaperProfile): Promise<void> };

export function SetupPage({ onComplete, onTestPrint }: Props) {
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<BridgeCapabilities>();
  const [profileId, setProfileId] = useState<PaperProfile["id"]>("80mm-576");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const probe = async () => {
    setLoading(true);
    setMessage("");
    try { const result = await getCapabilities(); setCapabilities(result); setProfileId((result.configuredProfileId as PaperProfile["id"]) || "80mm-576"); }
    catch (error) { setCapabilities(undefined); setMessage(error instanceof Error ? error.message : "The local bridge could not be reached."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    getCapabilities(controller.signal).then((result) => {
      setCapabilities(result);
      setProfileId((result.configuredProfileId as PaperProfile["id"]) || "80mm-576");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "The local bridge could not be reached.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const profile = capabilities?.profiles.find((item) => item.id === profileId) ?? { id: "80mm-576", label: "80 mm · 576 dots", paperWidthMm: 80, printableWidthDots: 576, paddingDots: 28 } as PaperProfile;
  const configure = async () => { setMessage("Saving printer…"); try { await saveConfiguration(profileId); onComplete(profile); navigate("/app"); } catch (error) { setMessage(error instanceof Error ? error.message : "Setup failed."); } };
  const test = async () => { setMessage("Sending a connection slip…"); try { await saveConfiguration(profileId); await onTestPrint(profile); setMessage("Connection slip sent."); } catch (error) { setMessage(error instanceof Error ? error.message : "The test print failed."); } };

  return <main className="setup-page"><header className="setup-top"><Brand compact /><button className="text-button" onClick={() => navigate("/")}><ArrowLeft size={14} />Back</button></header><section className="setup-card">
    <div className="setup-progress"><span className="active">1</span><i /><span className="active">2</span><i /><span className="active">3</span></div>
    <span className="kicker">Three small decisions</span><h1>Set up the local printer</h1><p className="setup-intro">The bridge stays on this machine and sends finished raster images directly to one Epson TM-L90.</p>
    <div className="setup-row"><div className="setup-row-icon"><Usb size={20} /></div><div className="setup-row-copy"><strong>Printer path</strong><span>Epson TM-L90 · direct USB</span><small>{loading ? "Looking for the bridge…" : capabilities?.connected ? "Bridge and printer detected" : capabilities ? capabilities.detail || "Bridge found; printer is not ready" : "Bridge unavailable"}</small></div><span className={`connection-badge ${capabilities?.connected ? "connected" : ""}`}>{capabilities?.connected ? <Check size={13} /> : <WifiOff size={13} />}{capabilities?.connected ? "Connected" : "Offline"}</span></div>
    <div className="setup-choice"><div><strong>Paper size</strong><small>The preview uses the printer’s exact dot width.</small></div><div className="paper-options">{(capabilities?.profiles ?? [profile]).map((item) => <button type="button" className={profileId === item.id ? "selected" : ""} onClick={() => setProfileId(item.id)} key={item.id}><span className={`paper-chip paper-${item.paperWidthMm}`} /><span><strong>{item.paperWidthMm} mm</strong><small>{item.printableWidthDots} printable dots</small></span>{profileId === item.id && <Check size={15} />}</button>)}</div></div>
    {message && <div className="setup-message">{message}</div>}
    <div className="setup-actions"><button className="button secondary" onClick={() => void probe()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />Check again</button><button className="button secondary" onClick={() => void test()} disabled={!capabilities?.connected}>Test print</button><button className="button primary" onClick={() => void configure()} disabled={!capabilities?.connected}>Finish setup<ArrowRight size={16} /></button></div>
  </section></main>;
}
