import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Moment } from "../pages/landing-demo";
import morning2048 from "../assets/scenes/morning-2048.webp";
import morning1024 from "../assets/scenes/morning-1024.webp";
import run2048 from "../assets/scenes/run-2048.webp";
import run1024 from "../assets/scenes/run-1024.webp";
import cook2048 from "../assets/scenes/cook-2048.webp";
import cook1024 from "../assets/scenes/cook-1024.webp";
import travel2048 from "../assets/scenes/travel-2048.webp";
import travel1024 from "../assets/scenes/travel-1024.webp";
import trail2048 from "../assets/scenes/trail-2048.webp";
import trail1024 from "../assets/scenes/trail-1024.webp";

/**
 * Each photograph is one 16:9 crop at two widths. `focus` is the object-position
 * that keeps the subject in frame when the stage narrows to 4/5 on a phone, and
 * `alt` describes the scene the receipt is sitting in.
 */
const SCENES: Record<Moment["id"], { src: string; srcSet: string; focus: string; alt: string }> = {
  morning: { src: morning2048, srcSet: `${morning1024} 1024w, ${morning2048} 2048w`, focus: "56% 62%", alt: "An open lawn in Central Park on a clear summer day, the Manhattan skyline behind the trees." },
  run: { src: run2048, srcSet: `${run1024} 1024w, ${run2048} 2048w`, focus: "38% 40%", alt: "A runner mid-stride across grass, caught with a blur of motion." },
  cook: { src: cook2048, srcSet: `${cook1024} 1024w, ${cook2048} 2048w`, focus: "42% 60%", alt: "Someone beating eggs in a glass bowl on a wooden kitchen counter." },
  travel: { src: travel2048, srcSet: `${travel1024} 1024w, ${travel2048} 2048w`, focus: "58% 46%", alt: "A vintage camper lit from inside at dusk, two people sitting out front." },
  trail: { src: trail2048, srcSet: `${trail1024} 1024w, ${trail2048} 2048w`, focus: "54% 52%", alt: "A campfire burning in a clearing as the woods go dark." },
};

/** The carousel is at most 1072 CSS px wide, and goes full-bleed inside the page gutter below that. */
const SIZES = "(max-width: 1168px) calc(100vw - 48px), 1072px";

/**
 * The slip is drawn in printer dots, the same units the receipt renderer uses, so the
 * torn edge scales with the paper instead of with the viewport. `INK_WIDTH` is the
 * printable width of an 80 mm roll; `MARGIN` is the blank paper around the ink.
 */
const INK_WIDTH = 576;
const MARGIN = 26;
const PAPER_WIDTH = INK_WIDTH + MARGIN * 2;
const TOOTH_WIDTH = 26;
const TOOTH_DEPTH = 9;

/** A receipt: cut square off the roll at the top, torn off by hand at the bottom. */
function paperOutline(height: number) {
  const teeth = Math.max(2, Math.round(PAPER_WIDTH / TOOTH_WIDTH));
  const step = PAPER_WIDTH / teeth;
  const path = [`M0,0`, `L${PAPER_WIDTH},0`, `L${PAPER_WIDTH},${height - TOOTH_DEPTH}`];
  for (let i = teeth - 1; i >= 0; i--) path.push(`L${((i + 0.5) * step).toFixed(1)},${height}`, `L${(i * step).toFixed(1)},${height - TOOTH_DEPTH}`);
  return `${path.join(" ")} Z`;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MomentsCarousel({ moments, variant = "section" }: { moments: Moment[]; variant?: "section" | "hero" }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = moments.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || reducedMotion()) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  return (
    <div
      className={`moments ${variant === "hero" ? "moments-hero" : ""}`}
      aria-roledescription="carousel"
      aria-label="Receipts in the wild"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="moments-stage">
        {moments.map((moment, position) => {
          const scene = SCENES[moment.id];
          const paperHeight = moment.inkHeight + MARGIN * 2;
          return (
            <div
              className={`moments-slide ${position === index ? "active" : ""}`}
              data-moment={moment.id}
              data-side={moment.placement.side}
              data-align={moment.placement.align}
              key={moment.id}
              aria-hidden={position !== index}
            >
              <img
                className="moments-scene"
                src={scene.src}
                srcSet={scene.srcSet}
                sizes={variant === "hero" ? "100vw" : SIZES}
                style={{ objectPosition: scene.focus }}
                width={2048}
                height={1152}
                alt={scene.alt}
                draggable={false}
                loading={position === 0 ? "eager" : "lazy"}
                decoding="async"
              />
              <div className="moments-scrim" aria-hidden="true" />
              <div className="moments-paper" style={{ aspectRatio: `${PAPER_WIDTH} / ${paperHeight}` }}>
                <svg className="moments-paper-edge" viewBox={`0 0 ${PAPER_WIDTH} ${paperHeight}`} aria-hidden="true">
                  <path d={paperOutline(paperHeight)} vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="moments-ink" dangerouslySetInnerHTML={{ __html: moment.ink }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="moments-dots" role="tablist" aria-label="Choose slide">
        {moments.map((moment, position) => (
          <button
            type="button"
            role="tab"
            key={moment.id}
            aria-selected={position === index}
            aria-label={moment.caption}
            className={position === index ? "active" : ""}
            onClick={() => go(position)}
          />
        ))}
      </div>
      <div className="moments-arrows">
        <button type="button" aria-label="Previous slide" onClick={() => go(index - 1)}><ChevronLeft size={17} /></button>
        <button type="button" aria-label="Next slide" onClick={() => go(index + 1)}><ChevronRight size={17} /></button>
      </div>
    </div>
  );
}
