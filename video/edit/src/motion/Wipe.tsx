import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { arrive, framesAt, palette } from "../theme";

/**
 * A solid edge wiping through, taking the cut with it.
 *
 * This is a transition device, not the shape-iconography system that got
 * retired — a wipe reads as a deliberate cut; a crossfade reads as filler.
 */
export const Wipe: React.FC<{
  readonly at: number;
  readonly color?: string;
  readonly direction?: "left" | "right" | "up";
  readonly duration?: number;
}> = ({ at, color = palette.backdrop, direction = "right", duration = 0.5 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [framesAt(at), framesAt(at + duration)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: arrive,
  });
  const lead = interpolate(t, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const tail = interpolate(t, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" });
  const axis = direction === "up" ? "Y" : "X";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: color,
        clipPath:
          axis === "X"
            ? `inset(0 ${(1 - lead) * 100}% 0 ${tail * 100}%)`
            : `inset(${tail * 100}% 0 ${(1 - lead) * 100}% 0)`,
      }}
    />
  );
};
