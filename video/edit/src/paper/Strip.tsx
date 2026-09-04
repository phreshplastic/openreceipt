import React from "react";
import { palette, shadow, jitterSigned } from "../theme";
import { stripPath } from "./edges";
import { THERMAL_VARIANTS, type ThermalVariant } from "./filters";

export const thermal = (id: string): ThermalVariant =>
  THERMAL_VARIANTS.find((variant) => variant.id === id) ?? THERMAL_VARIANTS[0];

type StripProps = {
  readonly width: number;
  readonly height: number;
  readonly variant?: string;
  readonly seed?: number;
  /**
   * How hard the strip remembers the roll, 0-1. A dead-flat receipt is the
   * giveaway — real thermal paper always curls.
   */
  readonly curl?: number;
  readonly rotate?: number;
  readonly serrateTop?: boolean;
  /**
   * Tooth depth as a fraction of width. Defaults to a real tear-off; pass
   * `APP_TOOTH_DEPTH_RATIO` when the shot must agree with the editor's own edge.
   */
  readonly depthRatio?: number;
  readonly style?: React.CSSProperties;
  readonly children?: React.ReactNode;
};

/**
 * The product's own stock. Bright, faintly cool, smooth, serrated where it tore
 * off the roll and dead straight down the slit sides.
 *
 * It must never borrow parchment's warmth, fibre, mottling, or torn edge — the
 * whole film turns on the viewer reading these as two different materials.
 */
export const Strip: React.FC<StripProps> = ({
  width,
  height,
  variant = "coated",
  seed = 1,
  curl = 0.5,
  rotate,
  serrateTop = false,
  depthRatio,
  style,
  children,
}) => {
  const stock = thermal(variant);
  const clip = `path('${stripPath({ width, height, seed, serrateTop, depthRatio })}')`;
  const angle = rotate ?? jitterSigned(seed * 5.3) * 0.6;

  return (
    <div
      style={{
        width,
        height,
        filter: shadow.strip,
        rotate: `${angle}deg`,
        // The curl is a perspective tilt, not a bend: cheap, and at these angles
        // indistinguishable from a warped mesh.
        perspective: 2400,
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width,
          height,
          clipPath: clip,
          WebkitClipPath: clip,
          rotate: `x ${curl * 2.4}deg`,
          transformOrigin: "50% 30%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            // Coated stock catches light unevenly across its width.
            background: `linear-gradient(100deg, ${palette.thermalShade} 0%, ${palette.thermal} ${18 + stock.sheen * 100}%, ${palette.thermal} ${82 - stock.sheen * 100}%, ${palette.thermalShade} 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: `url(#coating-${stock.id})`,
            opacity: stock.coatingOpacity,
            mixBlendMode: "overlay",
          }}
        />
        <div style={{ position: "absolute", inset: 0, filter: "url(#thermal-ink)" }}>{children}</div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to bottom, rgba(26,24,20,${0.3 * curl}) 0%, rgba(26,24,20,${0.1 * curl}) ${2.5 * curl}%, rgba(255,255,255,${0.85 * curl}) ${7 * curl}%, rgba(255,255,255,0) ${20 * curl}%, rgba(255,255,255,0) ${100 - 22 * curl}%, rgba(255,255,255,${0.7 * curl}) ${100 - 7 * curl}%, rgba(26,24,20,${0.12 * curl}) ${100 - 2.5 * curl}%, rgba(26,24,20,${0.36 * curl}) 100%)`,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};
