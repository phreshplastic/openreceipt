import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { easeOut } from "../theme";

export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export const FRAME: Rect = { x: 0, y: 0, width: 1920, height: 1080 };

/**
 * Move the frame from one rectangle of the 1920x1080 plane to another.
 *
 * Unlike everything in ../type, the camera is NOT quantised. A stuttering label
 * reads as printed; a stuttering camera reads as broken. It also settles before
 * the action it is there to show and holds afterwards — a crop that is still
 * drifting makes the interaction harder to verify, which defeats the point.
 */
export const Camera: React.FC<{
  readonly from?: Rect;
  readonly to?: Rect;
  /** Frame the move starts on. */
  readonly start?: number;
  /** 12-20 frames for a short reframe, 24-36 for a deliberate push. */
  readonly duration?: number;
  readonly children: React.ReactNode;
}> = ({ from = FRAME, to = FRAME, start = 0, duration = 28, children }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  const scale = 1920 / interpolate(t, [0, 1], [from.width, to.width]);
  const cx = interpolate(t, [0, 1], [from.x + from.width / 2, to.x + to.width / 2]);
  const cy = interpolate(t, [0, 1], [from.y + from.height / 2, to.y + to.height / 2]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          scale,
          translate: `${(960 - cx) / 1}px ${(540 - cy) / 1}px`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * A rectangle around a point, in the 1920x1080 plane. Handy for cropping to a
 * piece of captured UI once the real footage exists and the coordinates are known.
 */
export const around = (x: number, y: number, width: number): Rect => ({
  x: x - width / 2,
  y: y - (width * 9) / 16 / 2,
  width,
  height: (width * 9) / 16,
});
