import React from "react";
import { AbsoluteFill } from "remotion";
import { palette } from "../theme";

/**
 * The film's ground: a self-healing cutting mat, deliberately restrained.
 *
 * This is a surface, not a pattern. The grid is barely there — enough that the
 * eye reads "work surface" rather than "flat backdrop", not so much that it
 * competes with a screenshot laid on top. No edge numerals, no 30/45/60 angle
 * guides: those make it a novelty background, and it is on screen for roughly
 * 75 of the film's 81 seconds.
 *
 * Built from CSS gradients rather than an SVG filter on purpose. This renders
 * on all 2430 frames, and feTurbulence at full frame is expensive enough to
 * dominate render time for something the viewer should barely notice. Grain is
 * layered separately, once, over the whole composite.
 */
export const CuttingMat: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: palette.mat }}>
    {/* Minor grid, then major every fifth line. Both sit under everything. */}
    <AbsoluteFill
      style={{
        backgroundImage: [
          `repeating-linear-gradient(0deg, ${palette.matGrid} 0 1px, transparent 1px ${MINOR}px)`,
          `repeating-linear-gradient(90deg, ${palette.matGrid} 0 1px, transparent 1px ${MINOR}px)`,
          `repeating-linear-gradient(0deg, ${palette.matGridMajor} 0 1px, transparent 1px ${MAJOR}px)`,
          `repeating-linear-gradient(90deg, ${palette.matGridMajor} 0 1px, transparent 1px ${MAJOR}px)`,
        ].join(", "),
      }}
    />
    {/* Light falls off toward the edges, so the mat reads as a lit surface.
        Kept gentler than it was: a heavy vignette was washing the grid out at
        the edges, which is exactly where the ruled lines should still read. */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 100% at 50% 38%, rgba(255,255,255,0.055) 0%, transparent 36%), radial-gradient(135% 115% at 50% 42%, transparent 42%, rgba(0,0,0,0.26) 100%)",
      }}
    />
  </AbsoluteFill>
);

const MINOR = 48;
const MAJOR = 240;
