import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { arrive, framesAt, font, palette, radius, type } from "../theme";
import { PARCHMENT_VARIANTS } from "../paper";

/**
 * The film's one text-card material: parchment, but rebuilt as a rounded,
 * friendly card rather than a torn or serrated sheet. This is what "the
 * parchment idea, only if done well" means in practice — the warmth and the
 * paper grain stay, the receipt-stock associations (serration, curl) do not.
 *
 * The relief/mottle filter defs come from the existing paper system
 * (PaperFilters, mounted once per composition) — this just draws a plain
 * rounded rect and applies them at low opacity, layered so the card reads
 * as a surface sitting above whatever is behind it, not a flat sticker.
 */
export const Label: React.FC<{
  readonly children: React.ReactNode;
  readonly at?: number;
  readonly variant?: string;
  readonly size?: number;
  readonly style?: React.CSSProperties;
}> = ({ children, at = 0, variant = "vellum", size = type.annotation.size, style }) => {
  const frame = useCurrentFrame();
  const paper = PARCHMENT_VARIANTS.find((v) => v.id === variant) ?? PARCHMENT_VARIANTS[0];
  const t = interpolate(frame, [framesAt(at), framesAt(at + 0.4)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: arrive,
  });

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        borderRadius: radius.caption,
        overflow: "hidden",
        boxShadow: "0 2px 5px rgba(10,10,14,0.28), 0 18px 40px -14px rgba(10,10,14,0.5)",
        opacity: interpolate(t, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        translate: `0px ${interpolate(t, [0, 1], [14, 0])}px`,
        scale: interpolate(t, [0, 0.7, 1], [0.97, 1.006, 1]).toString(),
        ...style,
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundColor: palette.parchment }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `url(#relief-${paper.id})`,
          opacity: paper.reliefOpacity * 0.5,
          mixBlendMode: "overlay",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `url(#mottle-${paper.id})`,
          opacity: paper.mottleOpacity * 0.35,
          mixBlendMode: "multiply",
        }}
      />
      <div
        style={{
          position: "relative",
          padding: "18px 26px",
          fontFamily: font.text,
          fontSize: size,
          fontWeight: 650,
          lineHeight: 1.22,
          color: palette.ink,
        }}
      >
        {children}
      </div>
    </div>
  );
};
