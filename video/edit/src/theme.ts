/**
 * Design tokens for the OpenReceipt demo film.
 *
 * The film has two paper stocks and the difference is load-bearing: parchment is
 * the world, thermal receipt is the product. See ../LOOK.md. Anything that reads
 * as "the ground" uses `parchment`; anything that is the product's own output uses
 * `thermal`, and never borrows parchment's warmth, fibre, or torn edge.
 */

import { Easing } from "remotion";

export const FPS = 30;

/** Frame at a given real second — the whole film's timing primitive. */
export const framesAt = (seconds: number) => Math.round(seconds * FPS);

export const palette = {
  /**
   * The film's ground: a self-healing cutting mat. Everything the film shows is
   * an object laid on this surface — screen captures, phone video of the
   * printer, receipts, parchment cut-outs. Because the mat is always behind
   * every shot, the film has no empty frames between cuts.
   *
   * Desaturated and dark on purpose: white receipts and light product UI have
   * to be the brightest things on screen, and a saturated green would fight the
   * product's own blue accent.
   */
  mat: "#2e3f37",
  matGrid: "rgba(233,245,236,0.14)",
  matGridMajor: "rgba(238,248,240,0.26)",

  /**
   * The previous ground, kept because the studies still reference it. Dark
   * enough that light-mode product UI reads with real contrast; blue-tinted so
   * it sits in the same family as the product's own accent.
   */
  backdrop: "#14161c",
  backdropDeep: "#0b0c10",
  backdropLift: "#1d2028",

  /**
   * Parchment survives only as a caption-card material — warm, rounded,
   * friendly — never as the film's ground. A caption card is not receipt
   * stock: no serration, no curl, just a soft, slightly textured card.
   */
  parchment: "#f4ede0",
  parchmentDeep: "#e8dfcd",

  /** Thermal receipt: the product's own stock, used only for the real receipt render. Bright, faintly cool, never warm. */
  thermal: "#fdfdfe",
  thermalShade: "#f4f5f7",

  /** Ink is never pure black — printed ink on paper never is. */
  ink: "#141210",
  graphite: "#5b564e",
  pencil: "#8b857a",

  /** Off-white type for use on the dark backdrop. */
  paper: "#f6f4ef",
  paperDim: "#b7b6b2",

  /**
   * Inherited only. This blue appears where the captured UI already uses it —
   * the approval button, the agent chip, tool tags. Never invented elsewhere.
   */
  tint: "#0071e3",

  black: "#000000",
} as const;

export const radius = {
  card: 20,
  caption: 18,
} as const;

/**
 * One face, weight for hierarchy. Inter is what the product and the printed
 * receipt are both set in, so the film shares their type rather than performing
 * alongside it.
 */
export const font = {
  text: '"InterVar", Inter, ui-sans-serif, system-ui, sans-serif',
} as const;

/**
 * Sized for 1920x1080 read at phone scale: nothing meaningful below 26px.
 * Weight carries the hierarchy — 800 shouts, 500 supports — and tracking tightens
 * as size grows, the way it has to for a grotesque set large.
 */
export const type = {
  hero: { size: 156, tracking: -6, weight: 800 },
  title: { size: 96, tracking: -3.4, weight: 800 },
  lead: { size: 62, tracking: -1.8, weight: 700 },
  annotation: { size: 40, tracking: -0.7, weight: 600 },
  tag: { size: 31, tracking: 0.1, weight: 650 },
  caption: { size: 26, tracking: 0, weight: 500 },
} as const;

/** The product's own `--ease-out` (src/styles.css). Film and app move alike. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);

/**
 * One shadow floats, two shadows sit. Every sheet gets a tight contact shadow plus
 * a wide warm ambient.
 *
 * These are `filter: drop-shadow()` stacks, not `box-shadow`, because drop-shadow
 * follows the element's alpha — so a torn edge casts a torn shadow. `box-shadow`
 * would trace the clipped-away rectangle instead.
 */
export const shadow = {
  sheet:
    "drop-shadow(0 2px 3px rgba(58, 48, 34, 0.16)) drop-shadow(0 24px 48px rgba(58, 48, 34, 0.24))",
  sheetLifted:
    "drop-shadow(0 4px 6px rgba(58, 48, 34, 0.14)) drop-shadow(0 44px 72px rgba(58, 48, 34, 0.3))",
  /** The screen capture is a page laid on the desk, not a floating card. */
  plate:
    "drop-shadow(0 2px 4px rgba(40, 34, 24, 0.18)) drop-shadow(0 32px 56px rgba(40, 34, 24, 0.26))",
  /** A card floating over the ground, lifted further than a sheet lying on it. */
  card:
    "drop-shadow(0 3px 6px rgba(48, 40, 28, 0.14)) drop-shadow(0 40px 70px rgba(48, 40, 28, 0.26))",
  /** Receipt stock curls, so its contact shadow is tight and releases at the ends. */
  strip:
    "drop-shadow(0 1px 2px rgba(48, 44, 36, 0.22)) drop-shadow(0 14px 26px rgba(48, 44, 36, 0.22))",
} as const;

/**
 * Shapes and cards travel on this: fast out of the gate, settled well before the
 * next beat, with just enough overshoot to feel sprung rather than mechanical.
 */
export const arrive = Easing.bezier(0.16, 1.02, 0.24, 1);

/** Deterministic jitter so "imperfect" geometry is stable across renders. */
export const jitter = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Signed jitter in [-1, 1]. */
export const jitterSigned = (seed: number) => jitter(seed) * 2 - 1;

