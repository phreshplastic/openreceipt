import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { arrive, framesAt, palette, radius, shadow } from "../theme";

type CardProps = {
  readonly src?: string;
  readonly capture?: React.ReactNode;
  /**
   * How much of the frame the capture fills, 0.4-1.
   *
   * At 1 it is full bleed with no radius and no shadow — the proof state, where
   * nothing sits between the viewer and the evidence. Below 1 it is a card
   * floating on the backdrop. Animate it; do not cut between values.
   */
  readonly fill?: number;
  readonly at?: number;
  readonly fillFrom?: number;
  /** Degrees. A card arriving is rarely square to frame; a card at rest is. */
  readonly tilt?: number;
  readonly offset?: readonly [number, number];
  /**
   * "screen" and "phone" get the identical frame treatment on purpose — that
   * sameness is what makes a handheld printer shot read as an intentional part
   * of the film instead of a jarring drop in production value. "phone" only
   * differs by defaulting to a narrower card, since phone footage usually
   * isn't shot to fill 16:9.
   */
  readonly variant?: "screen" | "phone";
  readonly backdrop?: boolean;
  readonly style?: React.CSSProperties;
  readonly children?: React.ReactNode;
};

/**
 * Real capture, framed identically wherever it appears.
 *
 * The capture is never tinted, textured, or covered — the frame only holds it.
 * Kept deliberately plain: a rounded corner and a two-layer shadow, the same
 * frame for a screen recording or a phone video of the printer, so production
 * quality reads as consistent rather than as two different videos stitched
 * together.
 */
export const Card: React.FC<CardProps> = ({
  src,
  capture,
  fill = 0.72,
  at,
  fillFrom,
  tilt = 0,
  offset = [0, 0],
  variant = "screen",
  backdrop = true,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t =
    at === undefined || fillFrom === undefined
      ? 1
      : interpolate(frame, [framesAt(at), framesAt(at + 1.2)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: arrive,
        });

  const current = fillFrom === undefined ? fill : interpolate(t, [0, 1], [fillFrom, fill]);
  const clamped = Math.min(1, Math.max(0.3, current));
  const width = Math.round(1920 * clamped);
  const height = Math.round(1080 * clamped);
  // Object-fit: cover means the crop adapts to whatever aspect the real footage
  // turns out to be — no assumption baked in about portrait vs. landscape phone
  // video before that footage exists.
  const bleeding = clamped > 0.995 && variant === "screen";

  return (
    <AbsoluteFill>
      {backdrop && !bleeding ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(120% 100% at 30% -10%, ${palette.backdropLift} 0%, ${palette.backdrop} 55%, ${palette.backdropDeep} 100%)`,
          }}
        />
      ) : null}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...style }}>
        <div
          style={{
            position: "relative",
            width,
            height,
            filter: bleeding ? "none" : shadow.card,
            rotate: `${tilt * (1 - t)}deg`,
            translate: `${offset[0] * (1 - t)}px ${offset[1] * (1 - t)}px`,
          }}
        >
          <div
            style={{
              position: "relative",
              width,
              height,
              overflow: "hidden",
              borderRadius: bleeding ? 0 : radius.card,
              outline: bleeding ? "none" : "1px solid rgba(255,255,255,0.06)",
              outlineOffset: -1,
            }}
          >
            {capture ??
              (src ? (
                <Img
                  src={src.startsWith("http") ? src : staticFile(src)}
                  style={{ width, height, objectFit: "cover", objectPosition: "top center", display: "block" }}
                />
              ) : null)}
          </div>
        </div>
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
};
