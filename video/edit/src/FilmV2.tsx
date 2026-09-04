import React from "react";
import { AbsoluteFill, Freeze, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Audio, Video } from "@remotion/media";
import { FPS, arrive, font, framesAt, palette } from "./theme";
import { Grain, PaperFilters } from "./paper";
import { CuttingMat } from "./mat/CuttingMat";
import { Plate } from "./mat/Plate";
import { Motif } from "./mat/Motif";
import { Captions } from "./captions/Captions";
import { SHOTS, TOTAL_SECONDS, shotOrder, type ShotName } from "./shots";
import { fontsReady } from "./fonts";

void fontsReady;

/**
 * The film, built on the cutting mat.
 *
 * Two rules hold the whole thing together:
 *
 * 1. **No gaps.** Every shot runs until the next one starts. The previous cut
 *    placed each shot on its voiceover sentence and left the pauses between
 *    sentences empty, so the backdrop flashed through on eleven cuts — a 1.27s
 *    black hole at 51.47s among them. The mat is always behind everything now,
 *    and the shot list below is contiguous by construction (see SHOTS).
 *
 * 2. **Real footage, correctly cut.** Every in-point is a real second of real
 *    capture. Notably the printer: `physical-01` is a motionless idle machine
 *    until 5.6s, and the previous cut used 0.00-5.47 — it showed the idle
 *    printer and never the printing. Printing runs 5.6s to 14.57s.
 */

const f = framesAt;

/** Landscape screen capture is 2940x1762. */
const SCREEN_W = 1400;
const SCREEN_H = Math.round((SCREEN_W * 1762) / 2940);
/** Phone video, now genuinely 1080x1920 after being pre-rotated. */
const PHONE_H = 820;
const PHONE_W = Math.round((PHONE_H * 1080) / 1920);

/** A shot's duration is simply the distance to the next shot — gaps cannot exist. */
const span = (name: ShotName) => {
  const index = shotOrder.indexOf(name);
  return f(SHOTS[shotOrder[index + 1]]) - f(SHOTS[name]);
};

const Shot: React.FC<{ readonly name: ShotName; readonly children: React.ReactNode }> = ({ name, children }) => (
  <Sequence from={f(SHOTS[name])} durationInFrames={span(name)} name={name}>
    {children}
  </Sequence>
);

/**
 * A screen recording lying on the mat.
 *
 * Squared to frame, never tilted: a rotated screen recording reads as a
 * slideshow effect rather than an object, and the small angle fought the
 * footage's own straight edges. Paper motifs may sit askew; captured video
 * does not.
 */
const ScreenShot: React.FC<{ readonly src: string; readonly from: number }> = ({ src, from }) => (
  <Plate x={960} y={472} width={SCREEN_W} height={SCREEN_H} rotate={0}>
    <Video
      src={staticFile(src)}
      trimBefore={f(from)}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
    />
  </Plate>
);

/**
 * Phone video of the printer, in the identical frame treatment as the screen
 * captures. That sameness is the point: it makes handheld footage read as a
 * deliberate part of the film rather than a drop in quality.
 */
const PhoneShot: React.FC<{
  readonly src: string;
  readonly from: number;
  readonly x?: number;
  readonly rate?: number;
  readonly freezeAt?: number;
}> = ({ src, from, x = 660, rate = 1, freezeAt }) => {
  const video = (
    <Video
      src={staticFile(src)}
      trimBefore={f(from)}
      playbackRate={rate}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
  return (
    <Plate x={x} y={472} width={PHONE_W} height={PHONE_H} rotate={0}>
      {freezeAt === undefined ? video : <Freeze frame={f(freezeAt)}>{video}</Freeze>}
    </Plate>
  );
};

/**
 * A portrait clip only fills a third of a 16:9 frame, so the rest of the mat
 * gets an arrangement of cut paper to hold the other side down. Placed once and
 * still — the shapes are furniture on the desk, not animation.
 */
const PhoneCompanion: React.FC<{ readonly at?: number }> = ({ at = 0.2 }) => (
  <>
    <Motif kind="circle" size={300} x={1355} y={318} stock="ochre" seed={3} at={at} rotate={0} />
    <Motif kind="strip" size={318} x={1430} y={532} stock="parchment" seed={14} at={at + 0.16} rotate={-3} />
    <Motif kind="triangle" size={196} x={1352} y={720} stock="terracotta" seed={8} at={at + 0.3} rotate={-6} />
    <Motif kind="circle" size={84} x={1596} y={706} stock="sage" seed={21} at={at + 0.42} rotate={0} />
  </>
);

/**
 * The film opens and closes on the same thing: the product's own mark and
 * wordmark, white, centred on the mat. No photography — a stock lifestyle
 * picture sat outside the world the rest of the film builds, and the mark is
 * the honest version of the same beat.
 *
 * The mark ships black on transparent, so `brightness(0) invert(1)` forces it
 * to pure white while keeping its alpha.
 */
const Wordmark: React.FC<{ readonly at?: number; readonly tagline?: boolean }> = ({ at = 0, tagline = false }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [f(at), f(at + 0.9)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: arrive,
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: interpolate(t, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          translate: `0px ${interpolate(t, [0, 1], [18, 0])}px`,
        }}
      >
        <Img
          src={staticFile("openreceipt-mark.png")}
          style={{
            width: 150,
            filter: "brightness(0) invert(1) drop-shadow(0 8px 26px rgba(0,0,0,0.45))",
            marginBottom: 42,
          }}
        />
        <div
          style={{
            fontFamily: font.text,
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: -5,
            color: "#ffffff",
            lineHeight: 1,
            textShadow: "0 6px 34px rgba(0,0,0,0.4)",
          }}
        >
          OpenReceipt
        </div>
        {tagline ? (
          <div
            style={{
              fontFamily: font.text,
              fontSize: 38,
              fontWeight: 550,
              letterSpacing: -0.6,
              color: "rgba(255,255,255,0.88)",
              marginTop: 26,
              textShadow: "0 4px 22px rgba(0,0,0,0.4)",
            }}
          >
            A printer your agent can reach.
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Breadth: four real receipts dealt onto the mat, one per spoken noun, using
 * the real word timings — "grocery list" 58.38, "morning brief" 59.54,
 * "reminder" 61.01, "meeting notes" 61.60. They accumulate rather than
 * replacing each other, so the beat ends on the whole spread at once.
 */
const RECEIPT_W = 306;
const RECEIPT_TOP = 214;
const RECEIPT_MAX_H = 640;

/**
 * One receipt per noun the voiceover names, timed to the word itself. Each is
 * real output from the product's own renderer, drafted through the real
 * `draft_receipt` tool — see scripts/render-breadth-receipts.mts.
 */
const RECEIPTS = [
  { src: "generated/breadth-grocery.png", at: 58.38, x: 380, ratio: 1043 / 576, seed: 2 },
  { src: "generated/breadth-morning.png", at: 59.54, x: 767, ratio: 849 / 576, seed: 5 },
  { src: "generated/breadth-reminder.png", at: 61.01, x: 1153, ratio: 519 / 576, seed: 8 },
  { src: "generated/breadth-meeting.png", at: 61.6, x: 1540, ratio: 1145 / 576, seed: 11 },
] as const;

/**
 * Laid in a row from a common top edge, the way slips actually sit when you
 * deal them onto a desk. Centring them instead would make the differing
 * lengths read as scatter; hanging them from one line makes a short reminder
 * beside a long brief read as exactly what it is.
 */
const Breadth: React.FC = () => (
  <AbsoluteFill>
    {RECEIPTS.map((r) => {
      const height = Math.min(Math.round(RECEIPT_W * r.ratio), RECEIPT_MAX_H);
      return (
        <Plate
          key={r.src}
          x={r.x}
          y={RECEIPT_TOP + height / 2}
          width={RECEIPT_W}
          height={height}
          mount={10}
          seed={r.seed}
          at={r.at - SHOTS.breadth}
          enter={0.5}
          fromOffset={[0, 58]}
        >
          <Img src={staticFile(r.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
        </Plate>
      );
    })}
  </AbsoluteFill>
);

/** Three facts, timed to the real words, over the receipt the film just made. */
const BADGES = [
  { text: "Open-source", at: 70.88 },
  { text: "Local-first", at: 72.24 },
  { text: "WebMCP-enabled", at: 73.6 },
] as const;

const Badges: React.FC = () => (
  <AbsoluteFill>
    <Motif kind="circle" size={286} x={1290} y={252} stock="ochre" seed={71} at={0.1} rotate={0} opacity={0.9} />
    <Motif kind="triangle" size={176} x={1720} y={796} stock="terracotta" seed={77} at={0.3} rotate={-7} opacity={0.9} />
    <Motif kind="strip" size={250} x={220} y={880} stock="bone" seed={83} at={0.45} rotate={-3} opacity={0.9} />
    <Plate x={640} y={470} width={330} height={760} mount={12} rotate={0}>
      <Img
        src={staticFile("generated/surfing-trip.png")}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
      />
    </Plate>
    {BADGES.map((badge, index) => (
      <Sequence key={badge.text} from={f(badge.at) - f(SHOTS.badges)} name={badge.text}>
        <div
          style={{
            position: "absolute",
            left: 1090,
            top: 300 + index * 120,
            fontFamily: font.text,
            fontSize: 62,
            fontWeight: 800,
            letterSpacing: -1.8,
            color: palette.paper,
            textShadow: "0 2px 22px rgba(0,0,0,0.5)",
          }}
        >
          {badge.text}
        </div>
      </Sequence>
    ))}
  </AbsoluteFill>
);

/** Closes where it opened: the mark and the wordmark, plus the line the voice says. */
const EndCard: React.FC = () => (
  <AbsoluteFill>
    <Motif kind="circle" size={250} x={318} y={268} stock="ochre" seed={31} at={0.15} rotate={0} opacity={0.95} />
    <Motif kind="triangle" size={168} x={1596} y={318} stock="terracotta" seed={37} at={0.3} rotate={9} />
    <Motif kind="strip" size={300} x={330} y={806} stock="parchment" seed={41} at={0.42} rotate={-3} />
    <Motif kind="circle" size={104} x={1560} y={790} stock="sage" seed={47} at={0.54} rotate={0} />
    <Wordmark at={0} tagline />
  </AbsoluteFill>
);

/**
 * Music level.
 *
 * Measured, not guessed: the voiceover is -25.5 LUFS and this bed is -17.8
 * LUFS, so the music is 7.7 LU LOUDER than the speech before any attenuation.
 * 0.055 puts it near -43 LUFS, roughly 17 LU under the narration.
 *
 * The previous bed was sidechain-ducked against the voiceover, which made it
 * pump mid-sentence (6.9 LU range against 1.4 LU for this un-ducked track).
 * Level changes here happen only inside real gaps between spoken sentences —
 * the 1.27s hole at 51.47 and the outro after the last word at 77.92 — never
 * under speech.
 */
const BASE = 0.055;
const LIFT = 0.13;
const musicVolume = (frame: number) => {
  const t = frame / FPS;
  return interpolate(t, [51.6, 51.95, 52.45, 52.68, 77.95, 78.4], [BASE, LIFT, LIFT, BASE, BASE, LIFT], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export { TOTAL_SECONDS };
export const durationInFrames = f(TOTAL_SECONDS);

export const FilmV2: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: palette.mat }}>
    <PaperFilters />
    <CuttingMat />

    <Shot name="hero">
      <Motif kind="circle" size={230} x={330} y={300} stock="ochre" seed={2} at={0.05} rotate={0} />
      <Motif kind="triangle" size={150} x={1570} y={340} stock="terracotta" seed={9} at={0.2} rotate={7} />
      <Motif kind="strip" size={260} x={340} y={790} stock="parchment" seed={15} at={0.32} rotate={-3} />
      <Wordmark at={0} />
    </Shot>
    {/*
      Edge motifs for the long screen-capture stretch. Mounted once across the
      whole run rather than per shot, so they hold still through the cuts
      instead of popping in and out on every one. They sit in the narrow margin
      beside the plate and run off the frame, which reads as a desk continuing
      past the edge rather than as shapes arranged for the camera.
    */}
    <Sequence from={f(SHOTS.prompt)} durationInFrames={f(SHOTS.printing) - f(SHOTS.prompt)}>
      <Motif kind="circle" size={264} x={54} y={246} stock="sage" seed={51} at={0.3} rotate={0} opacity={0.9} />
      <Motif kind="strip" size={288} x={96} y={892} stock="bone" seed={57} at={0.5} rotate={-4} opacity={0.9} />
      <Motif kind="circle" size={150} x={1872} y={262} stock="ochre" seed={63} at={0.42} rotate={0} opacity={0.9} />
      <Motif kind="triangle" size={214} x={1884} y={784} stock="slate" seed={69} at={0.6} rotate={8} opacity={0.9} />
    </Sequence>

    <Shot name="prompt">
      <ScreenShot src="footage/screen-01-prompt-draft.mov" from={0} />
    </Shot>
    <Shot name="draftLands">
      <ScreenShot src="footage/screen-01-prompt-draft.mov" from={64} />
    </Shot>
    <Shot name="tools">
      <ScreenShot src="footage/screen-02-tools-popover.mov" from={6} />
    </Shot>
    <Shot name="receiptDetail">
      <ScreenShot src="footage/screen-01-prompt-draft.mov" from={68} />
    </Shot>
    <Shot name="followUp">
      <ScreenShot src="footage/screen-03-edit-air-quality.mov" from={4} />
    </Shot>
    <Shot name="agentEdit">
      <ScreenShot src="footage/screen-03-edit-air-quality.mov" from={25} />
    </Shot>
    <Shot name="preview">
      <ScreenShot src="footage/screen-04-preview-print.mov" from={0} />
    </Shot>
    <Shot name="approve">
      <ScreenShot src="footage/screen-04-preview-print.mov" from={3.88} />
    </Shot>

    {/* The match cut: approve on screen, straight into paper actually moving. */}
    <Shot name="printing">
      <PhoneShot src="footage/physical-01-full-print-portrait.mp4" from={5.6} />
      <PhoneCompanion at={0.35} />
    </Shot>

    <Shot name="breadth">
      <Breadth />
    </Shot>

    {/* Tear at 0.8x for weight, then hold the frame where the receipt is legible. */}
    <Shot name="tear">
      <Sequence durationInFrames={f(3.81)}>
        <PhoneShot src="footage/physical-02-tear-portrait.mp4" from={0} rate={0.8} />
      </Sequence>
      <Sequence from={f(3.81)}>
        <PhoneShot src="footage/physical-02-tear-portrait.mp4" from={0} rate={0.8} freezeAt={3.78} />
      </Sequence>
      <PhoneCompanion at={0.25} />
    </Shot>

    <Shot name="badges">
      <Badges />
    </Shot>
    <Shot name="endCard">
      <EndCard />
    </Shot>

    {/* Captions stop before the badges: those words are already on screen. */}
    <Captions until={f(SHOTS.badges)} />

    <Grain opacity={0.03} />

    <Audio src={staticFile("voiceover/openreceipt-vo.mp3")} />
    <Audio src={staticFile("audio/music-bed-trimmed.wav")} volume={musicVolume} />
  </AbsoluteFill>
);
