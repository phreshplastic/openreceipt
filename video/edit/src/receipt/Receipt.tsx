import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { arrive, framesAt, palette, shadow } from "../theme";
import geometry from "../../public/generated/surfing-trip.geometry.json";
import { stripPath } from "../paper";

export const RECEIPT = geometry;

export const block = (kind: string) => {
  const found = geometry.blocks.find((b) => b.kind === kind);
  if (!found) throw new Error(`No "${kind}" block. Kinds: ${geometry.blocks.map((b) => b.kind).join(", ")}`);
  return found;
};

/**
 * The real receipt, rendered by the product's own renderer.
 *
 * `scripts/render-demo-receipt.mts` exports the PNG and the per-block geometry
 * together, so reveals and punch-ins address blocks by name rather than by
 * hand-measured pixels, and stay correct when the document is re-rendered.
 */
export const Receipt: React.FC<{
  readonly width: number;
  /** Reveal blocks one at a time from this framesAt, one every `every` beats. */
  readonly assembleFrom?: number;
  readonly every?: number;
  /** Scroll so this block sits near the top of the visible strip. */
  readonly scrollTo?: string;
  readonly scrollAt?: number;
  /** Visible height in px; the strip clips to it. Defaults to the whole receipt. */
  readonly viewport?: number;
  readonly curl?: number;
  readonly style?: React.CSSProperties;
}> = ({ width, assembleFrom, every = 0.5, scrollTo, scrollAt = 0, viewport, curl = 0, style }) => {
  const frame = useCurrentFrame();
  const scale = width / geometry.width;
  const fullHeight = geometry.height * scale;
  const visible = viewport ?? fullHeight;

  const offset = scrollTo
    ? -interpolate(frame, [framesAt(scrollAt), framesAt(scrollAt + 2)], [0, block(scrollTo).y * scale - 40], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: arrive,
      })
    : 0;

  const clip = `path('${stripPath({ width, height: visible, seed: 3 })}')`;

  return (
    <div style={{ width, height: visible, filter: shadow.strip, ...style }}>
      <div
        style={{
          position: "relative",
          width,
          height: visible,
          overflow: "hidden",
          clipPath: clip,
          WebkitClipPath: clip,
          backgroundColor: palette.thermal,
        }}
      >
        <div style={{ position: "absolute", left: 0, top: offset, width, height: fullHeight }}>
          <Img src={staticFile("generated/surfing-trip.png")} style={{ width, height: fullHeight, display: "block" }} />
          {/* Blocks land one at a time: paper covers what has not arrived yet. */}
          {assembleFrom === undefined
            ? null
            : geometry.blocks.map((b, index) => (
                <div
                  key={b.id}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: b.y * scale - 2,
                    width,
                    height: b.height * scale + 6,
                    backgroundColor: palette.thermal,
                    opacity: interpolate(
                      frame,
                      [framesAt(assembleFrom + index * every), framesAt(assembleFrom + index * every + 0.35)],
                      [1, 0],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: arrive },
                    ),
                  }}
                />
              ))}
        </div>
        {curl > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to bottom, rgba(26,24,20,${0.26 * curl}) 0%, rgba(255,255,255,${0.7 * curl}) ${6 * curl}%, rgba(255,255,255,0) ${18 * curl}%, rgba(255,255,255,0) ${100 - 20 * curl}%, rgba(255,255,255,${0.6 * curl}) ${100 - 6 * curl}%, rgba(26,24,20,${0.3 * curl}) 100%)`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
