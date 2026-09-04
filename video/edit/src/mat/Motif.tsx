import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { arrive, framesAt, jitterSigned, shadow } from "../theme";
import { PARCHMENT_VARIANTS } from "../paper";
import { motifBox, motifPath, type MotifKind } from "./shapes";

/**
 * Construction paper and parchment, in colours that sit on the mat without
 * fighting the product's own blue or the white of a receipt. Muted and slightly
 * chalky, the way cheap coloured paper actually is.
 */
export const paperStock = {
  parchment: "#f2ead9",
  bone: "#e7dcc6",
  ochre: "#cd9a4b",
  terracotta: "#b7663f",
  sage: "#7f9070",
  slate: "#5b6b76",
  ink: "#2b2b28",
} as const;

export type PaperStock = keyof typeof paperStock;

/**
 * A shape cut out of paper and set down on the mat.
 *
 * Texture is what keeps these from being the generic geometry that got retired
 * from this project earlier: each one is a real paper surface — the same relief
 * and mottle filters the sheets use — clipped to a hand-cut outline, with a
 * drop-shadow that follows the shape's own alpha, so a wobbly edge casts a
 * wobbly shadow.
 *
 * They settle once and then hold. Nothing here spins, drifts or pulses.
 */
export const Motif: React.FC<{
  readonly kind: MotifKind;
  readonly size: number;
  readonly x: number;
  readonly y: number;
  readonly stock?: PaperStock;
  readonly variant?: string;
  /** Seconds, relative to the enclosing sequence. */
  readonly at?: number;
  readonly rotate?: number;
  readonly seed?: number;
  readonly opacity?: number;
}> = ({ kind, size, x, y, stock = "parchment", variant = "vellum", at, rotate, seed = 1, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const paper = PARCHMENT_VARIANTS.find((v) => v.id === variant) ?? PARCHMENT_VARIANTS[0];
  const clip = `path('${motifPath(kind, size, seed)}')`;
  const spin = rotate ?? jitterSigned(seed * 9.1) * 6;
  const box = motifBox(kind, size);

  const t =
    at === undefined
      ? 1
      : interpolate(frame, [framesAt(at), framesAt(at + 0.55)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: arrive,
        });

  return (
    <div
      style={{
        position: "absolute",
        left: Math.round(x - box.width / 2),
        top: Math.round(y - box.height / 2),
        width: box.width,
        height: box.height,
        rotate: `${spin}deg`,
        opacity: interpolate(t, [0, 0.4], [0, opacity], { extrapolateRight: "clamp" }),
        translate: `0px ${interpolate(t, [0, 1], [22, 0])}px`,
        filter: shadow.sheet,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: box.width,
          height: box.height,
          clipPath: clip,
          WebkitClipPath: clip,
          isolation: "isolate",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundColor: paperStock[stock] }} />
        {/* Held deliberately low. Coarse relief over a saturated colour stops
            reading as paper stock and starts reading as sandpaper or glitter;
            what sells cut paper at this size is the edge and the shadow, with
            only a whisper of tooth in the surface. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: `url(#relief-${paper.id})`,
            opacity: paper.reliefOpacity * 0.3,
            mixBlendMode: "overlay",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: `url(#mottle-${paper.id})`,
            opacity: paper.mottleOpacity * 0.4,
            mixBlendMode: "multiply",
          }}
        />
        {/* Sheet stock is never evenly lit where it curls away from the light. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(146deg, rgba(255,255,255,0.16) 0%, transparent 42%, rgba(0,0,0,0.13) 100%)",
          }}
        />
      </div>
    </div>
  );
};
