import React from "react";
import { palette, shadow, jitterSigned } from "../theme";
import { sheetPath, type SheetEdges } from "./edges";
import { PARCHMENT_VARIANTS, type PaperVariant } from "./filters";

export const parchment = (id: string): PaperVariant =>
  PARCHMENT_VARIANTS.find((variant) => variant.id === id) ?? PARCHMENT_VARIANTS[0];

type SheetProps = {
  readonly width: number;
  readonly height: number;
  readonly variant?: string;
  /** Torn edges bite; cut edges are dead straight. Mixing the two is the point. */
  readonly edges?: SheetEdges;
  readonly seed?: number;
  readonly color?: string;
  readonly lifted?: boolean;
  /** Degrees. No sheet on a desk is square to the frame. */
  readonly rotate?: number;
  readonly style?: React.CSSProperties;
  readonly children?: React.ReactNode;
};

export const Sheet: React.FC<SheetProps> = ({
  width,
  height,
  variant = "laid",
  edges = { top: "cut", right: "torn", bottom: "torn", left: "cut" },
  seed = 1,
  color = palette.parchment,
  lifted = false,
  rotate,
  style,
  children,
}) => {
  const paper = parchment(variant);
  const clip = `path('${sheetPath({ width, height, edges, seed })}')`;
  const angle = rotate ?? jitterSigned(seed * 3.7) * 0.8;

  return (
    <div
      style={{
        width,
        height,
        // drop-shadow follows the alpha shape, so a torn edge casts a torn shadow.
        // Two shadows: one sits the sheet down, one gives it the room's ambient.
        filter: lifted ? shadow.sheetLifted : shadow.sheet,
        rotate: `${angle}deg`,
        ...style,
      }}
    >
      <div style={{ position: "relative", width, height, clipPath: clip, WebkitClipPath: clip, isolation: "isolate" }}>
        <div style={{ position: "absolute", inset: 0, backgroundColor: color }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: `url(#relief-${paper.id})`,
            opacity: paper.reliefOpacity,
            mixBlendMode: "overlay",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: `url(#mottle-${paper.id})`,
            opacity: paper.mottleOpacity,
            mixBlendMode: "multiply",
          }}
        />
        {paper.fleckOpacity > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              filter: `url(#fleck-${paper.id})`,
              opacity: paper.fleckOpacity,
              mixBlendMode: "multiply",
            }}
          />
        ) : null}
        {/* A torn edge exposes a lighter core; without it the bite reads as a cut. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 0 1.5px rgba(255, 253, 246, 0.55)",
            pointerEvents: "none",
          }}
        />
        {children}
      </div>
    </div>
  );
};

/**
 * A sheet laid over another carries a faint mirrored ghost of what is beneath.
 * Printed matter is translucent; this is the detail that sells a stack as paper
 * rather than as layered rectangles.
 */
export const ShowThrough: React.FC<{
  readonly opacity?: number;
  readonly children: React.ReactNode;
}> = ({ opacity = 0.055, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity,
      filter: "blur(1px) grayscale(1)",
      scale: "-1 1",
      mixBlendMode: "multiply",
      pointerEvents: "none",
    }}
  >
    {children}
  </div>
);
