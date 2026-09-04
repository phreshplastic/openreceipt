import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FPS, font, palette, radius } from "../theme";
import { PARCHMENT_VARIANTS } from "../paper";
import { chunkAt, chunkCaptions } from "./chunk";

const CHUNKS = chunkCaptions();
const PAPER = PARCHMENT_VARIANTS.find((v) => v.id === "vellum") ?? PARCHMENT_VARIANTS[0];

const WIDTH = 1180;
const TOP = 946;

/**
 * Captions on a parchment strip.
 *
 * This is where the paper-motif idea earns its place: the caption is the motif,
 * doing a real job, instead of a decorative cut-out floating beside the action.
 *
 * The strip is a fixed size and never moves. Sizing it to each caption would
 * make it pulse on every line — roughly every 1.5 seconds for 70 seconds — and
 * that reads as a glitch. The text inside swaps hard, exactly as subtitles do;
 * only the strip itself fades, and only when speech actually stops.
 *
 * Timing comes from `chunk.ts`, which groups the real Whisper word tokens
 * measured off this exact audio file. Nothing here is hand-timed.
 */
export const Captions: React.FC<{ readonly until?: number }> = ({ until }) => {
  const frame = useCurrentFrame();
  const ms = (frame / FPS) * 1000;

  if (until !== undefined && frame >= until) return null;

  const chunk = chunkAt(CHUNKS, ms);
  if (!chunk) return null;

  // Fade only at the edges of a spoken run, so continuous speech never flickers.
  const fade = Math.min(
    interpolate(ms, [chunk.startMs, chunk.startMs + 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(ms, [chunk.endMs - 90, chunk.endMs], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  // A chunk that runs straight into the next one should not dip at the seam.
  const next = chunkAt(CHUNKS, chunk.endMs + 1);
  const previous = CHUNKS.find((c) => c.endMs === chunk.startMs);
  const opacity = Math.max(next ? 1 : fade, previous ? 1 : fade);

  return (
    <div
      style={{
        position: "absolute",
        left: (1920 - WIDTH) / 2,
        top: TOP,
        width: WIDTH,
        borderRadius: radius.caption,
        overflow: "hidden",
        opacity,
        boxShadow: "0 2px 6px rgba(10,12,10,0.3), 0 20px 44px -16px rgba(8,10,8,0.55)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundColor: palette.parchment }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `url(#relief-${PAPER.id})`,
          opacity: PAPER.reliefOpacity * 0.45,
          mixBlendMode: "overlay",
        }}
      />
      <div
        style={{
          position: "relative",
          padding: "16px 34px",
          textAlign: "center",
          fontFamily: font.text,
          fontSize: 40,
          fontWeight: 650,
          lineHeight: 1.24,
          letterSpacing: -0.5,
          color: palette.ink,
          whiteSpace: "nowrap",
        }}
      >
        {chunk.text}
      </div>
    </div>
  );
};
