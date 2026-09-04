import React from "react";
/**
 * Surface filters for the film's two paper stocks.
 *
 * Realistic paper is not a noise overlay. Parchment needs fibre AND cloudy
 * mottling, then a diffuse light driven off that noise as a bump map — the
 * lighting pass is what turns a texture into a surface. Thermal receipt stock
 * needs the opposite: almost nothing, because its realism lives in the serrated
 * edge and the curl, not the grain.
 */

export type PaperVariant = {
  readonly id: string;
  readonly label: string;
  /** Fibre frequency, x and y. Paper is milled, so the grain is directional. */
  readonly fibre: readonly [number, number];
  /** How far the light rakes across the fibre. */
  readonly surfaceScale: number;
  readonly reliefOpacity: number;
  /** Low-frequency tonal blotching. Without it, paper reads as sandpaper. */
  readonly mottleFrequency: number;
  readonly mottleOpacity: number;
  readonly fleckOpacity: number;
  readonly azimuth: number;
  /** Light elevation in degrees. Low rakes across the tooth; high flattens it. */
  readonly elevation: number;
  /** Contrast expansion applied to the lighting pass before it is blended. */
  readonly reliefContrast: number;
};

export const PARCHMENT_VARIANTS: readonly PaperVariant[] = [
  {
    id: "laid",
    label: "Laid — directional mill grain, raking light",
    fibre: [0.55, 0.95],
    surfaceScale: 1.8,
    reliefOpacity: 0.72,
    mottleFrequency: 0.009,
    mottleOpacity: 0.34,
    fleckOpacity: 0.05,
    elevation: 18,
    reliefContrast: 3.4,
    azimuth: 228,
  },
  {
    id: "cartridge",
    label: "Cartridge — tighter tooth, flatter light",
    fibre: [0.85, 0.85],
    surfaceScale: 1.2,
    reliefOpacity: 0.55,
    mottleFrequency: 0.014,
    mottleOpacity: 0.26,
    fleckOpacity: 0.03,
    elevation: 26,
    reliefContrast: 2.6,
    azimuth: 200,
  },
  {
    id: "kraft",
    label: "Kraft — coarse fibre, heavy blotch",
    fibre: [0.4, 0.7],
    surfaceScale: 2.6,
    reliefOpacity: 0.9,
    mottleFrequency: 0.006,
    mottleOpacity: 0.44,
    fleckOpacity: 0.1,
    elevation: 14,
    reliefContrast: 4.2,
    azimuth: 244,
  },
  {
    id: "vellum",
    label: "Vellum — near-smooth, cloud only",
    fibre: [1.4, 1.4],
    surfaceScale: 0.7,
    reliefOpacity: 0.4,
    mottleFrequency: 0.011,
    mottleOpacity: 0.3,
    fleckOpacity: 0.0,
    elevation: 30,
    reliefContrast: 2.0,
    azimuth: 215,
  },
];

export type ThermalVariant = {
  readonly id: string;
  readonly label: string;
  readonly coatingFrequency: number;
  readonly coatingOpacity: number;
  /** How much the coated surface catches light across the strip's width. */
  readonly sheen: number;
};

export const THERMAL_VARIANTS: readonly ThermalVariant[] = [
  { id: "coated", label: "Coated — faint sheen across the width", coatingFrequency: 0.95, coatingOpacity: 0.1, sheen: 0.055 },
  { id: "matte", label: "Matte — flatter, cheaper roll", coatingFrequency: 0.7, coatingOpacity: 0.16, sheen: 0.022 },
];

export const PaperFilters: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <defs>
      {PARCHMENT_VARIANTS.map((variant) => (
        <React.Fragment key={variant.id}>
          {/* Fibre + cloud combined into a height field, then lit. */}
          <filter id={`relief-${variant.id}`} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${variant.fibre[0]} ${variant.fibre[1]}`}
              numOctaves={4}
              seed={7}
              result="fibre"
            />
            <feTurbulence type="fractalNoise" baseFrequency={0.013} numOctaves={4} seed={19} result="cloud" />
            <feComposite in="fibre" in2="cloud" operator="arithmetic" k1={0} k2={0.72} k3={0.4} k4={-0.06} result="bump" />
            <feDiffuseLighting
              in="bump"
              surfaceScale={variant.surfaceScale}
              diffuseConstant={1}
              lightingColor="#ffffff"
              result="lit"
            >
              {/* Low elevation. A raking light is the only thing that reveals tooth;
                  light from overhead flattens paper into card. */}
              <feDistantLight azimuth={variant.azimuth} elevation={variant.elevation} />
            </feDiffuseLighting>
            {/* Expand around mid-grey so `overlay` has something to bite on. */}
            <feComponentTransfer in="lit">
              <feFuncR type="linear" slope={variant.reliefContrast} intercept={0.5 - variant.reliefContrast * 0.5} />
              <feFuncG type="linear" slope={variant.reliefContrast} intercept={0.5 - variant.reliefContrast * 0.5} />
              <feFuncB type="linear" slope={variant.reliefContrast} intercept={0.5 - variant.reliefContrast * 0.5} />
            </feComponentTransfer>
          </filter>

          {/* Tonal blotching. Colour, not relief — this is the stain, not the tooth. */}
          <filter id={`mottle-${variant.id}`} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${variant.mottleFrequency} ${variant.mottleFrequency * 1.3}`}
              numOctaves={5}
              seed={23}
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.66  0 0 0 0 0.63  0 0 0 0 0.56  0 0 0 0.3 0"
            />
          </filter>

          {/* Rare dark specks. Real stock has inclusions; vector paper does not. */}
          <filter id={`fleck-${variant.id}`} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={0.55} numOctaves={1} seed={41} />
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1" />
            </feComponentTransfer>
            <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.27  0 0 0 0 0.22  0 0 0 1 0" />
          </filter>
        </React.Fragment>
      ))}

      {THERMAL_VARIANTS.map((variant) => (
        <filter key={variant.id} id={`coating-${variant.id}`} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={variant.coatingFrequency} numOctaves={2} seed={5} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.52  0 0 0 0.5 0" />
        </filter>
      ))}

      {/* Thermal print is sharp but never razor-clean — ink sits on the coating. */}
      <filter id="thermal-ink" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={0.8} numOctaves={2} seed={13} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={0.45} xChannelSelector="R" yChannelSelector="G" />
        <feGaussianBlur stdDeviation={0.16} />
      </filter>
    </defs>
  </svg>
);
