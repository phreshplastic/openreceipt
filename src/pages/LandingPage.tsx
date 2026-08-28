import { ArrowRight, Bot, MousePointer2, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";

export function LandingPage({ configured }: { configured: boolean }) {
  const navigate = useNavigate();
  return <main className="landing">
    <nav className="landing-nav"><Brand /><button className="text-button" onClick={() => navigate(configured ? "/app" : "/setup")}>{configured ? "Open printer" : "Set up"}<ArrowRight size={15} /></button></nav>
    <section className="hero">
      <div className="hero-copy"><span className="kicker">A shared surface for people and agents</span><h1>Make a little<br />something.</h1><p>Edit a receipt by hand, let an agent shape it with you, then send exactly what you see to a thermal printer.</p><button className="button primary hero-button" onClick={() => navigate(configured ? "/app" : "/setup")}>{configured ? "Open Pete’s Printer" : "Set up your printer"}<ArrowRight size={17} /></button></div>
      <div className="hero-object" aria-label="Sample thermal receipt"><div className="hero-paper"><span className="micro">PETE’S PRINTER</span><strong>THINGS FOR<br />THE MORNING</strong><i /><p><b>□</b> Pack the charger</p><p><b>□</b> Take the blue folder</p><p><b>✓</b> Make coffee</p><i /><small>MADE TO BE USED</small></div><div className="hero-shadow" /></div>
    </section>
    <section className="landing-notes"><div><MousePointer2 size={18} /><strong>Edit the paper</strong><p>The receipt is the canvas, so there’s no builder between you and the thing.</p></div><div><Bot size={18} /><strong>Share the state</strong><p>WebMCP gives compatible agents the same receipt operations as the visible interface.</p></div><div><Printer size={18} /><strong>Print locally</strong><p>A small bridge keeps physical hardware and uncertain delivery out of the browser.</p></div></section>
  </main>;
}
