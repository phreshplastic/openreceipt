import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Bot, Cpu, Monitor, Notebook, ShoppingBag, Wallet } from "lucide-react";
import printerSrc from "../assets/tm-l90.png";

type Props = { slipSrc: string; svgWidth: number; svgHeight: number; ctaHref: string };
type DemoStatus = "idle" | "feeding" | "printed" | "retracting";
type SourceId = "computer" | "agent" | "pi";

const sources: { id: SourceId; name: string; detail: string; icon: typeof Monitor }[] = [
  { id: "computer", name: "Computer", detail: "This browser", icon: Monitor },
  { id: "agent", name: "Agent", detail: "WebMCP", icon: Bot },
  { id: "pi", name: "Raspberry Pi", detail: "The local bridge", icon: Cpu },
];

const places: { name: string; detail: string; icon: typeof Monitor }[] = [
  { name: "Wallet", detail: "In a pocket", icon: Wallet },
  { name: "Notebook", detail: "On the desk", icon: Notebook },
  { name: "Tote", detail: "Out the door", icon: ShoppingBag },
];

const acrossPipes = [
  "M0 16.5 C 62 16.5, 62 50, 100 50",
  "M0 50 H 100",
  "M0 83.5 C 62 83.5, 62 50, 100 50",
];
const downPipes = [
  "M16.5 0 C 16.5 62, 50 62, 50 100",
  "M50 0 V 100",
  "M83.5 0 C 83.5 62, 50 62, 50 100",
];
const outAcrossPipes = [
  "M0 50 C 38 50, 38 16.5, 100 16.5",
  "M0 50 H 100",
  "M0 50 C 38 50, 38 83.5, 100 83.5",
];
const outDownPipes = [
  "M50 0 C 50 38, 16.5 38, 16.5 100",
  "M50 0 V 100",
  "M50 0 C 50 38, 83.5 38, 83.5 100",
];

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Dot = { left: number; top: number; s: number; o: number };

function visiblePaths(across: RefObject<(SVGPathElement | null)[]>, down: RefObject<(SVGPathElement | null)[]>) {
  if (across.current[0]?.getClientRects().length) return across.current;
  if (down.current[0]?.getClientRects().length) return down.current;
  return null;
}

function sampleDot(path: SVGPathElement | null | undefined, t: number, host: DOMRect, fade: "in" | "out", blendT: number): Dot | null {
  if (!path || path.getTotalLength() <= 0) return null;
  const ctm = path.getScreenCTM();
  if (!ctm) return null;
  const along = path.getPointAtLength(t * path.getTotalLength());
  const screen = new DOMPoint(along.x, along.y).matrixTransform(ctm);
  let opacity = 1;
  if (fade === "in") {
    if (t < 0.08) opacity = t / 0.08;
    else if (t > 1 - blendT) opacity = (1 - t) / blendT;
  } else if (t < blendT) opacity = t / blendT;
  else if (t > 0.9) opacity = (1 - t) / 0.1;
  const pulse = 1 + 0.16 * Math.sin(t * Math.PI * 2);
  return { left: screen.x - host.left, top: screen.y - host.top, s: pulse, o: opacity };
}

function useTravelingDots(
  host: RefObject<HTMLDivElement | null>,
  inAcross: RefObject<(SVGPathElement | null)[]>,
  inDown: RefObject<(SVGPathElement | null)[]>,
  outAcross: RefObject<(SVGPathElement | null)[]>,
  outDown: RefObject<(SVGPathElement | null)[]>,
) {
  const [dots, setDots] = useState<{ inbound: Dot | null; outbound: Dot | null }>({ inbound: null, outbound: null });

  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const ride = 2100;
    const blend = 180;
    const blendT = blend / ride;
    const pairLength = 2 * ride - blend;
    const count = sources.length;
    const origin = performance.now();
    const frame = (now: number) => {
      const box = host.current?.getBoundingClientRect();
      if (!box) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const elapsed = now - origin;
      const pair = Math.floor(elapsed / pairLength) % count;
      const local = elapsed % pairLength;
      const inbound = local < ride
        ? sampleDot(visiblePaths(inAcross, inDown)?.[pair], local / ride, box, "in", blendT)
        : null;
      const outT = (local - (ride - blend)) / ride;
      const outbound = outT >= 0 && outT <= 1
        ? sampleDot(visiblePaths(outAcross, outDown)?.[count - 1 - pair], outT, box, "out", blendT)
        : null;
      setDots({ inbound, outbound });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [host, inAcross, inDown, outAcross, outDown]);

  return dots;
}

function PipeSvg({
  className,
  paths,
  pathRefs,
  liveId,
}: {
  className: string;
  paths: string[];
  pathRefs?: RefObject<(SVGPathElement | null)[]>;
  liveId?: SourceId | null;
}) {
  return (
    <svg className={`printer-demo-pipes ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((d, index) => (
        <path
          key={d}
          ref={pathRefs ? (node) => { pathRefs.current[index] = node; } : undefined}
          className={liveId && sources[index]?.id === liveId ? "printer-demo-pipe is-live" : "printer-demo-pipe"}
          d={d}
        />
      ))}
    </svg>
  );
}

export function PrinterDemo({ slipSrc, svgWidth, svgHeight, ctaHref }: Props) {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [source, setSource] = useState<SourceId | null>(null);
  const [feedKey, setFeedKey] = useState(0);
  const retractTimer = useRef(0);
  const diagramRef = useRef<HTMLDivElement>(null);
  const acrossRefs = useRef<(SVGPathElement | null)[]>([]);
  const downRefs = useRef<(SVGPathElement | null)[]>([]);
  const outAcrossRefs = useRef<(SVGPathElement | null)[]>([]);
  const outDownRefs = useRef<(SVGPathElement | null)[]>([]);
  const { inbound, outbound } = useTravelingDots(diagramRef, acrossRefs, downRefs, outAcrossRefs, outDownRefs);

  useEffect(() => () => window.clearTimeout(retractTimer.current), []);

  const feed = (next?: SourceId) => {
    if (status === "feeding" || status === "retracting") return;
    if (next) setSource(next);
    if (reducedMotion()) {
      setStatus(status === "printed" ? "idle" : "printed");
      return;
    }
    if (status === "idle") {
      requestAnimationFrame(() => setStatus("feeding"));
      return;
    }
    setStatus("retracting");
    window.clearTimeout(retractTimer.current);
    retractTimer.current = window.setTimeout(() => {
      setFeedKey((key) => key + 1);
      requestAnimationFrame(() => setStatus("feeding"));
    }, 280);
  };

  const stageStyle = { "--slip-ratio": svgHeight / svgWidth } as CSSProperties;

  return (
    <section className="printer-demo" aria-label="How a receipt reaches the printer">
      <div className="printer-demo-diagram" ref={diagramRef}>
        <div className="printer-demo-from">
          <p className="printer-demo-label">Send from</p>
          <div className="printer-demo-inputs">
            <div className="printer-demo-sources">
              {sources.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={source === item.id ? "printer-demo-source is-active" : "printer-demo-source"}
                    type="button"
                    onClick={() => feed(item.id)}
                    aria-label={`Send from ${item.name}`}
                    aria-pressed={source === item.id && (status === "printed" || status === "feeding")}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="printer-demo-source-copy">
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="printer-demo-pipe-well">
              <PipeSvg className="printer-demo-pipes-across" paths={acrossPipes} pathRefs={acrossRefs} liveId={source} />
            </div>
          </div>
          <PipeSvg className="printer-demo-pipes-down" paths={downPipes} pathRefs={downRefs} liveId={source} />
        </div>
        <div className="printer-demo-stage" style={stageStyle}>
          <img className="printer-demo-printer" src={printerSrc} alt="Epson TM-L90 thermal printer" draggable={false} />
          <div
            className={`printer-demo-slot is-${status}`}
            onAnimationEnd={(event) => {
              if (event.animationName !== "printer-slot-feed" || status !== "feeding") return;
              setStatus("printed");
            }}
            onTransitionEnd={(event) => {
              if (event.propertyName !== "height" || status !== "retracting") return;
              setStatus("idle");
            }}
          >
            <div key={feedKey} className="printer-demo-paper"><img src={slipSrc} alt="Sample printed morning brief" /></div>
          </div>
          <div className="printer-demo-slot-bar" aria-hidden="true" />
          <button
            className="printer-demo-feed"
            type="button"
            onClick={() => feed()}
            aria-label={status === "printed" ? "Reprint sample receipt" : "Print sample receipt"}
            aria-pressed={status === "printed" || status === "feeding"}
          >
            Print
          </button>
        </div>
        <div className="printer-demo-to">
          <PipeSvg className="printer-demo-pipes-down printer-demo-pipes-out" paths={outDownPipes} pathRefs={outDownRefs} />
          <p className="printer-demo-label">Take it with you</p>
          <div className="printer-demo-outputs">
            <div className="printer-demo-pipe-well printer-demo-pipe-well-out">
              <PipeSvg className="printer-demo-pipes-across" paths={outAcrossPipes} pathRefs={outAcrossRefs} />
            </div>
            <div className="printer-demo-places">
              {places.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="printer-demo-place" key={item.name}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="printer-demo-source-copy">
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {[inbound, outbound].map((dot, index) =>
          dot ? (
            <span
              key={index}
              className="printer-demo-dot"
              style={{ left: dot.left, top: dot.top, opacity: dot.o, transform: `translate(-50%, -50%) scale(${dot.s})` }}
              aria-hidden="true"
            />
          ) : null,
        )}
      </div>
      <a className="printer-demo-cta" href={ctaHref}>Launch editor</a>
      <span className="printer-demo-status" aria-live="polite">
        {status === "printed" || status === "feeding" ? "Sample slip printed." : "Printer ready."}
      </span>
    </section>
  );
}
