import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { palette, font, type, arrive, framesAt } from "../theme";
import { fontsReady } from "../fonts";

void fontsReady;

/**
 * One typeface, weight for hierarchy, everything arriving on a framesAt.
 *
 * `at` is measured in beats, not frames, so retiming the film to a different
 * track is a change to BPM in one place rather than a pass over every delay.
 */

const useArrival = (at: number, span = 0.55) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [framesAt(at), framesAt(at + span)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: arrive,
  });
};

type TextProps = {
  readonly children: React.ReactNode;
  /** Beat this lands on. */
  readonly at?: number;
  readonly size?: number;
  readonly weight?: number;
  readonly color?: string;
  readonly tracking?: number;
  /** Direction the line travels in from, in px. */
  readonly rise?: number;
  readonly style?: React.CSSProperties;
};

const Text: React.FC<TextProps> = ({
  children,
  at = 0,
  size = type.lead.size,
  weight = type.lead.weight,
  color = palette.ink,
  tracking,
  rise = 26,
  style,
}) => {
  const t = useArrival(at);
  return (
    <div
      style={{
        fontFamily: font.text,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: tracking ?? (size > 120 ? type.hero.tracking : size > 80 ? type.title.tracking : size > 50 ? type.lead.tracking : type.annotation.tracking),
        lineHeight: 1.02,
        color,
        opacity: interpolate(t, [0, 0.35], [0, 1], { extrapolateRight: "clamp" }),
        translate: `0px ${interpolate(t, [0, 1], [rise, 0])}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** The largest thing in the film. Two or three words, never a sentence. */
export const Hero: React.FC<TextProps> = (props) => (
  <Text size={type.hero.size} weight={type.hero.weight} {...props} />
);

/** A headline over footage or ground. */
export const Line: React.FC<TextProps> = (props) => <Text {...props} />;

/** Supporting copy. Quieter weight, never quieter than 500. */
export const Sub: React.FC<TextProps> = (props) => (
  <Text size={type.annotation.size} weight={500} color={palette.graphite} {...props} />
);

/**
 * A named WebMCP tool.
 *
 * The only place the product blue appears outside captured UI, and only because
 * the captured UI already uses it for exactly this: naming what the agent did.
 * It snaps in with a framesAt of overshoot, because in the reel a tool call is an
 * event, not a caption.
 */
export const ToolTag: React.FC<{
  readonly children: string;
  readonly at?: number;
  readonly style?: React.CSSProperties;
}> = ({ children, at = 0, style }) => {
  const t = useArrival(at, 0.4);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 13,
        padding: "13px 24px 14px",
        borderRadius: 999,
        backgroundColor: palette.tint,
        boxShadow: "0 2px 4px rgba(0,60,120,0.18), 0 18px 36px -12px rgba(0,70,140,0.42)",
        fontFamily: font.text,
        fontSize: type.tag.size,
        fontWeight: type.tag.weight,
        letterSpacing: type.tag.tracking,
        color: "#fff",
        whiteSpace: "nowrap",
        opacity: interpolate(t, [0, 0.25], [0, 1], { extrapolateRight: "clamp" }),
        scale: interpolate(t, [0, 0.62, 1], [0.86, 1.035, 1], { output: "perceptual-scale" }),
        ...style,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.92)", flexShrink: 0 }} />
      {children}
    </div>
  );
};
