import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { arrive, framesAt, palette } from "../theme";

/**
 * A click ring over the real cursor's position.
 *
 * The capture already contains a real cursor; inventing a second one would be
 * fabricating interface behaviour. This only marks the moment a real click
 * happened, so the eye lands where the person actually acted — and the ring
 * expires, because a persistent marker stops meaning "now".
 */
export const ClickRing: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly at: number;
  readonly color?: string;
  readonly size?: number;
}> = ({ x, y, at, color = palette.tint, size = 108 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [framesAt(at), framesAt(at + 1.1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: arrive,
  });
  if (t <= 0 || t >= 1) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `4px solid ${color}`,
        opacity: interpolate(t, [0, 0.12, 1], [0, 0.85, 0]),
        scale: interpolate(t, [0, 1], [0.35, 1.5], { output: "perceptual-scale" }),
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * A soft spotlight that dims everything except one rectangle of the capture.
 *
 * Used when the narration names a detail the crop cannot reach on its own — a
 * single checklist line, one field in the approval panel.
 */
export const Spotlight: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly at: number;
  readonly until: number;
  readonly dim?: number;
}> = ({ x, y, width, height, at, until, dim = 0.42 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(
    frame,
    [framesAt(at), framesAt(at + 0.6), framesAt(until), framesAt(until + 0.5)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: arrive },
  );
  if (t <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: `rgba(20, 18, 16, ${dim * t})`,
        clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x}px ${y}px, ${x}px ${y + height}px, ${x + width}px ${y + height}px, ${x + width}px ${y}px, ${x}px ${y}px)`,
        pointerEvents: "none",
      }}
    />
  );
};
