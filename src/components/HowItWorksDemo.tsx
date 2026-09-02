import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

// WebGL is decorative here. It arrives in its own chunk after the page paints, and a
// painted CSS field stands in until it does, so the section never shows a hole.
const HowDemoGradient = lazy(() => import("./HowDemoGradient"));

function HowDemoBackdrop({ view, playing }: { view: number; playing: boolean }) {
  return (
    <div className="how-demo-gradient" data-view={view}>
      {playing && <Suspense fallback={null}><HowDemoGradient view={view} /></Suspense>}
    </div>
  );
}

function HowDemoStage({
  playing,
  className,
  view,
  children,
}: {
  playing: boolean;
  className: string;
  view: number;
  children: ReactNode;
}) {
  return (
    <div className={`how-demo-stage ${className} ${playing ? "is-playing" : ""}`} aria-hidden="true">
      <HowDemoBackdrop view={view} playing={playing} />
      <div className="how-demo-veil" />
      {children}
    </div>
  );
}

function ReceiptLines() {
  return (
    <div className="how-demo-receipt-lines">
      <span className="how-demo-receipt-title">Sea Ranch</span>
      <span className="how-demo-receipt-date">Friday → Sunday</span>
      <span className="how-demo-receipt-rule" />
      <span className="how-demo-receipt-line"><i>□</i> Rain shell</span>
      <span className="how-demo-receipt-line"><i>□</i> Trail shoes</span>
      <span className="how-demo-receipt-line"><i>□</i> Phone charger</span>
      <span className="how-demo-receipt-line"><i>□</i> Coffee beans</span>
    </div>
  );
}

function DraftDemo({ playing }: { playing: boolean }) {
  return (
    <HowDemoStage playing={playing} className="how-demo-draft" view={0}>
      <div className="how-demo-chat">
        <div className="how-demo-chat-user"><span>You</span><p>Make me a packing list for Sea Ranch.</p></div>
        <div className="how-demo-chat-agent">
          <span className="how-demo-agent-mark"><i /><i /><i /></span>
          <div><strong>Agent</strong><p>Drafting your receipt<span className="how-demo-working"><i /><i /><i /></span></p></div>
        </div>
        <div className="how-demo-composer"><span>Message your agent</span><i className="how-demo-send">↑</i></div>
      </div>
      <div className="how-demo-paper how-demo-draft-paper">
        <ReceiptLines />
      </div>
    </HowDemoStage>
  );
}

function EditDemo({ playing }: { playing: boolean }) {
  return (
    <HowDemoStage playing={playing} className="how-demo-edit" view={1}>
      <div className="how-demo-paper how-demo-edit-paper">
        <ReceiptLines />
        <div className="how-demo-human-cursor">
          <svg viewBox="0 0 18 22"><path d="M2 1.7v16.8l4.4-4.1 3.1 6.2 2.8-1.4-3-6.1 5.9-.3L2 1.7Z" /></svg>
          <span>You</span>
        </div>
        <div className="how-demo-agent-cursor">
          <svg viewBox="0 0 18 22"><path d="M2 1.7v16.8l4.4-4.1 3.1 6.2 2.8-1.4-3-6.1 5.9-.3L2 1.7Z" /></svg>
          <span>Agent</span>
        </div>
      </div>
      <div className="how-demo-sync"><i /> Same paper</div>
    </HowDemoStage>
  );
}

function PrintDemo({ playing }: { playing: boolean }) {
  return (
    <HowDemoStage playing={playing} className="how-demo-print" view={2}>
      <div className="how-demo-paper-channel">
        <div className="how-demo-print-paper how-demo-paper">
          <ReceiptLines />
          <span className="how-demo-receipt-footer">CABIN 4 · HIGHWAY 1</span>
        </div>
      </div>
      <div className="how-demo-printer">
        <span className="how-demo-printer-slot" />
        <span className="how-demo-printer-name">OPENRECEIPT</span>
        <span className="how-demo-printer-led" />
        <span className="how-demo-printer-button" />
      </div>
    </HowDemoStage>
  );
}

export function HowItWorksDemo({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setPlaying(true);
      observer.disconnect();
    }, { threshold: 0.3 });

    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className="how-demo-root">
      {step === 0 ? <DraftDemo playing={playing} /> : step === 1 ? <EditDemo playing={playing} /> : <PrintDemo playing={playing} />}
    </div>
  );
}
