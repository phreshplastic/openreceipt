import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { arrive, framesAt, jitterSigned, radius, shadow } from "../theme";

type PlateProps = {
  /** Centre of the plate on the 1920x1080 plane. */
  readonly x?: number;
  readonly y?: number;
  /** Size of the media itself; the paper mount is drawn outside this. */
  readonly width: number;
  readonly height: number;
  /** Degrees. Omit for a small deterministic tilt so nothing sits perfectly square. */
  readonly rotate?: number;
  readonly seed?: number;
  /** White paper margin around the media. 0 for a bare screen. */
  readonly mount?: number;
  /** Seconds. With `enter`, the plate settles onto the mat instead of cutting in. */
  readonly at?: number;
  readonly enter?: number;
  /** Where it comes from, relative to its resting place. */
  readonly fromOffset?: readonly [number, number];
  readonly style?: React.CSSProperties;
  readonly children?: React.ReactNode;
};

/**
 * A framed object lying on the mat.
 *
 * `Card` cannot do this job: it is always centred, always sized as a 16:9
 * fraction of the frame, and its `tilt`/`offset` are arrival offsets that decay
 * to zero rather than resting values.
 *
 * The important rule is that a landscape screen recording and a portrait phone
 * video of the printer get the *identical* treatment here — same paper mount,
 * same shadow, same slight tilt. That sameness is what makes handheld footage
 * read as a deliberate part of the film rather than as a drop in production
 * quality, and it is why the portrait clips do not need pillarboxing: they are
 * simply smaller objects on the same desk.
 */
export const Plate: React.FC<PlateProps> = ({
  x = 960,
  y = 540,
  width,
  height,
  rotate,
  seed = 1,
  mount = 14,
  at,
  enter = 0.7,
  fromOffset = [0, 46],
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const rest = rotate ?? jitterSigned(seed * 3.7) * 0.9;

  const t =
    at === undefined
      ? 1
      : interpolate(frame, [framesAt(at), framesAt(at + enter)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: arrive,
        });

  const outerWidth = width + mount * 2;
  const outerHeight = height + mount * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: Math.round(x - outerWidth / 2),
        top: Math.round(y - outerHeight / 2),
        width: outerWidth,
        height: outerHeight,
        opacity: interpolate(t, [0, 0.35], [0, 1], { extrapolateRight: "clamp" }),
        translate: `${fromOffset[0] * (1 - t)}px ${fromOffset[1] * (1 - t)}px`,
        // Arrives a touch more tilted than it rests, the way a dropped print does.
        rotate: `${rest + rest * 1.6 * (1 - t)}deg`,
        filter: shadow.card,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#f7f5f0",
          borderRadius: mount > 0 ? radius.card * 0.5 : radius.card,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: mount,
          top: mount,
          width,
          height,
          overflow: "hidden",
          borderRadius: mount > 0 ? 3 : radius.card,
          backgroundColor: "#0d0f12",
        }}
      >
        {children}
      </div>
    </div>
  );
};
