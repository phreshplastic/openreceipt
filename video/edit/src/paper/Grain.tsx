import React from "react";
import { useCurrentFrame } from "remotion";

/** Grain refreshes every this many frames — fast enough to read as film grain, slow enough not to shimmer. */
const REFRESH_FRAMES = 9;

/**
 * Fine grain over the whole composite.
 *
 * Without it the frame stays vector-clean and every other paper trick collapses:
 * a photographed surface has grain, a rendered one does not, and the eye knows.
 */
export const Grain: React.FC<{ readonly opacity?: number }> = ({ opacity = 0.042 }) => {
  const frame = useCurrentFrame();
  const seed = (Math.floor(frame / REFRESH_FRAMES) % 4) + 1;

  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <defs>
          <filter id={`grain-${seed}`} colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={0.72} numOctaves={2} seed={seed} />
            <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `url(#grain-${seed})`,
          opacity,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
