import React from "react";
import { AbsoluteFill, Freeze, Img, Sequence, staticFile } from "remotion";
import { Audio, Video } from "@remotion/media";
import { framesAt, font, palette } from "./theme";
import { Grain } from "./paper";
import { Card } from "./plate/Card";
import { fontsReady } from "./fonts";

void fontsReady;

/**
 * TEMPORARY: true only while the two Desktop screen recordings (prompt/draft
 * and the WebMCP tools popover) are still stuck re-downloading over Pete's
 * plane wifi. Flip to false (or delete this and the Placeholder branches
 * below) the moment footage/screen-01-prompt-draft.mov and
 * footage/screen-02-tools-popover.mov are real files again.
 */
const AWAITING_SCREEN_01_02 = false;

const Placeholder: React.FC<{ readonly label: string }> = ({ label }) => (
  <AbsoluteFill style={{ backgroundColor: palette.backdropDeep, alignItems: "center", justifyContent: "center" }}>
    <div style={{ fontFamily: font.text, fontSize: 30, fontWeight: 600, color: palette.paperDim, textAlign: "center", maxWidth: 900 }}>
      {label}
      <div style={{ fontSize: 22, fontWeight: 500, color: "rgba(183,182,178,0.55)", marginTop: 12 }}>
        Real capture syncing from iPhone/iCloud — dropping in once it lands.
      </div>
    </div>
  </AbsoluteFill>
);

/**
 * The real film: one continuous narrated cut, built entirely against the
 * approved, locked voiceover (public/voiceover/openreceipt-vo.mp3, 78.18s) and
 * the real Whisper transcription's word timing. Every cut point below is a real
 * second value from video/shot-plan.json's sequences or from the sentence/word
 * timing JSON next to the VO file — nothing here is a guessed duration.
 *
 * Footage sources are the real captures logged in
 * video/assets/screen/footage-log.md (screen) and Pete's own phone video of the
 * Epson TM-L90 (physical) — copied into public/footage with plain names. B-roll
 * is used at exactly the three places video/assets/broll-manifest.md allows:
 * hook, same-flow, end-card. Everywhere else is real product UI or real paper.
 */

const f = framesAt;

/** A real product-UI capture, framed full-bleed — the "proof" state described in Card. */
const ScreenClip: React.FC<{ readonly src: string; readonly trimBefore: number; readonly trimAfter: number }> = ({
  src,
  trimBefore,
  trimAfter,
}) => (
  <Card
    fill={1}
    variant="screen"
    capture={
      <Video
        src={staticFile(src)}
        trimBefore={f(trimBefore)}
        trimAfter={f(trimAfter)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
      />
    }
  />
);

/**
 * Pete's own phone footage of the real printer, in the identical frame
 * language as the screen captures on purpose — see Card's own doc comment.
 * Never full-bleed: staying a visibly framed, filmed object is what makes
 * handheld phone footage read as intentional rather than a quality drop.
 */
const PhoneClip: React.FC<{
  readonly src: string;
  readonly trimBefore: number;
  readonly trimAfter: number;
  readonly freezeAt?: number;
}> = ({ src, trimBefore, trimAfter, freezeAt }) => {
  const video = (
    <Video
      src={staticFile(src)}
      trimBefore={f(trimBefore)}
      trimAfter={f(trimAfter)}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
  return (
    <Card fill={0.8} variant="phone" capture={freezeAt !== undefined ? <Freeze frame={f(freezeAt)}>{video}</Freeze> : video} />
  );
};

/** Real Pexels B-roll, full-bleed, no card — this is the world outside the app, not evidence of it. */
const Broll: React.FC<{ readonly src: string; readonly trimBefore?: number; readonly trimAfter?: number }> = ({
  src,
  trimBefore,
  trimAfter,
}) => (
  <AbsoluteFill>
    <Video
      src={staticFile(src)}
      trimBefore={trimBefore !== undefined ? f(trimBefore) : undefined}
      trimAfter={trimAfter !== undefined ? f(trimAfter) : undefined}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </AbsoluteFill>
);

/**
 * Plain typographic badge, not a caption card — a fact stated once, not a note
 * pinned to the screen. Words and timing are the real ones from the VO's own
 * Whisper transcription (public/voiceover/openreceipt-vo.captions.json).
 */
const Badge: React.FC<{ readonly children: React.ReactNode; readonly from: number; readonly to: number }> = ({
  children,
  from,
  to,
}) => (
  <Sequence from={f(from)} durationInFrames={f(to) - f(from)}>
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "flex-end", padding: "0 0 96px 100px" }}>
      <div
        style={{
          fontFamily: font.text,
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: -2,
          color: palette.paper,
          textShadow: "0 2px 24px rgba(0,0,0,0.55)",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  </Sequence>
);

/**
 * The end card: real B-roll, the site's own `.moments-hero` scrim recipe (exact
 * gradient values from src/styles.css), the real receipt with only a
 * drop-shadow. This is the confirmed still from DirectionStudy's
 * `DirectionEndCard`, minus its dev-facing annotation label.
 */
const EndCard: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: palette.backdrop }}>
    <Img
      src={staticFile("broll/stills/street-murals-frame.png")}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }}
    />
    <AbsoluteFill
      style={{
        background: [
          "linear-gradient(180deg, rgb(7 10 14 / 48%) 0%, transparent 22%)",
          "linear-gradient(90deg, transparent 35%, rgb(7 10 14 / 47%) 66%, rgb(7 10 14 / 72%) 100%)",
          "linear-gradient(0deg, rgb(7 10 14 / 42%) 0%, transparent 30%)",
        ].join(", "),
      }}
    />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: "96px 0 0" }}>
      <div style={{ fontFamily: font.text, fontSize: 64, fontWeight: 800, color: "#fff", letterSpacing: -2 }}>
        OpenReceipt
      </div>
      <div style={{ fontFamily: font.text, fontSize: 26, fontWeight: 550, color: "rgba(255,255,255,0.82)", marginTop: 10 }}>
        A printer your agent can reach.
      </div>
    </AbsoluteFill>
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "center", padding: "0 130px 0 0" }}>
      <Img
        src={staticFile("generated/surfing-trip.png")}
        style={{ height: 840, filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.42))" }}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

export const TOTAL_SECONDS = 81;
export const durationInFrames = f(TOTAL_SECONDS);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: palette.backdrop }}>
    {/* hook — 0.00–1.81s — real VO begins immediately, no silent pre-roll */}
    <Sequence from={0} durationInFrames={f(1.81)}>
      <Broll src="broll/surf-aerial.mp4" trimBefore={0} trimAfter={1.81} />
    </Sequence>

    {/* ask-agent — 2.14–10.73s — real prompt typed and sent, real dead-air held, not cut to zero */}
    <Sequence from={f(2.14)} durationInFrames={f(10.73) - f(2.14)}>
      {AWAITING_SCREEN_01_02 ? (
        <Placeholder label="You tell your agent about it and ask it to put together a list of everything you'll need." />
      ) : (
        <ScreenClip src="footage/screen-01-prompt-draft.mov" trimBefore={0} trimAfter={8.59} />
      )}
    </Sequence>

    {/* real-tools — 10.81–20.12s — the draft reveal, then the real WebMCP tool list, named and legible */}
    <Sequence from={f(10.81)} durationInFrames={f(15.11) - f(10.81)}>
      {AWAITING_SCREEN_01_02 ? (
        <Placeholder label="OpenReceipt gives it real tools: list_receipt_recipes, draft_receipt." />
      ) : (
        <ScreenClip src="footage/screen-01-prompt-draft.mov" trimBefore={64} trimAfter={68} />
      )}
    </Sequence>
    <Sequence from={f(15.11)} durationInFrames={f(20.12) - f(15.11)}>
      {AWAITING_SCREEN_01_02 ? (
        <Placeholder label="The real WebMCP tool list — eleven named tools, not a canned template." />
      ) : (
        <ScreenClip src="footage/screen-02-tools-popover.mov" trimBefore={6} trimAfter={11.31} />
      )}
    </Sequence>

    {/* blocks-assemble — 20.24–28.06s — continuing the same push-in on the assembled receipt */}
    <Sequence from={f(20.24)} durationInFrames={f(28.06) - f(20.24)}>
      {AWAITING_SCREEN_01_02 ? (
        <Placeholder label="A countdown, a packing list, even a surf forecast — all laid out and ready to read." />
      ) : (
        <ScreenClip src="footage/screen-01-prompt-draft.mov" trimBefore={68} trimAfter={75.82} />
      )}
    </Sequence>

    {/* human-edit — 28.06–34.48s — the real follow-up prompt, real dead-air held */}
    <Sequence from={f(28.06)} durationInFrames={f(34.48) - f(28.06)}>
      <ScreenClip src="footage/screen-03-edit-air-quality.mov" trimBefore={4} trimAfter={10.42} />
    </Sequence>

    {/* shared-canvas — 34.72–42.97s — the agent's edit_receipt call landing */}
    <Sequence from={f(34.72)} durationInFrames={f(42.97) - f(34.72)}>
      <ScreenClip src="footage/screen-03-edit-air-quality.mov" trimBefore={25} trimAfter={33.25} />
    </Sequence>

    {/* preview — 43.20–47.08s — real preview_receipt response */}
    <Sequence from={f(43.2)} durationInFrames={f(47.08) - f(43.2)}>
      <ScreenClip src="footage/screen-04-preview-print.mov" trimBefore={0} trimAfter={3.88} />
    </Sequence>

    {/* print — 47.28–51.47s — the one match cut: approve on screen, straight into the real printer starting */}
    <Sequence from={f(47.28)} durationInFrames={f(49.78) - f(47.28)}>
      <ScreenClip src="footage/screen-04-preview-print.mov" trimBefore={3.88} trimAfter={6.38} />
    </Sequence>
    <Sequence from={f(49.78)} durationInFrames={f(51.47) - f(49.78)}>
      <PhoneClip src="footage/physical-01-full-print.mov" trimBefore={0} trimAfter={1.69} />
    </Sequence>

    {/* autonomous-aside — 52.74–56.52s — a true settings toggle, no dedicated new shot, stay on the printer */}
    <Sequence from={f(52.74)} durationInFrames={f(56.52) - f(52.74)}>
      <PhoneClip src="footage/physical-01-full-print.mov" trimBefore={1.69} trimAfter={5.47} />
    </Sequence>

    {/* same-flow — 56.64–65.68s — breadth montage, hard cuts, no crossfades, per broll-manifest.md */}
    <Sequence from={f(56.64)} durationInFrames={f(59.64) - f(56.64)}>
      <Broll src="broll/grocery-cloth-bag.mp4" trimBefore={0} trimAfter={3} />
    </Sequence>
    <Sequence from={f(59.64)} durationInFrames={f(62.64) - f(59.64)}>
      <Broll src="broll/coffee-pour-morning.mp4" trimBefore={0} trimAfter={3} />
    </Sequence>
    <Sequence from={f(62.64)} durationInFrames={f(65.68) - f(62.64)}>
      <Broll src="broll/sticky-note-writing.mp4" trimBefore={0} trimAfter={3.04} />
    </Sequence>

    {/* carry-it — 65.92–70.76s — the real tear, then held on the real final frame */}
    <Sequence from={f(65.92)} durationInFrames={f(68.97) - f(65.92)}>
      <PhoneClip src="footage/physical-02-tear.mov" trimBefore={0} trimAfter={3.05} />
    </Sequence>
    <Sequence from={f(68.97)} durationInFrames={f(70.76) - f(68.97)}>
      <PhoneClip src="footage/physical-02-tear.mov" trimBefore={0} trimAfter={3.05} freezeAt={3.0} />
    </Sequence>

    {/* badges — 70.88–75.27s — three facts, timed to the real words, over the printer still running */}
    <Sequence from={f(70.88)} durationInFrames={f(75.27) - f(70.88)}>
      <PhoneClip src="footage/physical-01-full-print.mov" trimBefore={5.47} trimAfter={9.86} />
    </Sequence>
    <Badge from={70.88} to={72.24}>Open-source.</Badge>
    <Badge from={72.24} to={73.6}>Local-first.</Badge>
    <Badge from={73.6} to={75.27}>WebMCP-enabled.</Badge>

    {/* end-card — 75.31–81.00s — the landing page's own hero recipe, real receipt, held past the last word */}
    <Sequence from={f(75.31)} durationInFrames={durationInFrames - f(75.31)}>
      <EndCard />
    </Sequence>

    <Grain opacity={0.028} />

    <Audio src={staticFile("voiceover/openreceipt-vo.mp3")} />
    <Audio src={staticFile("audio/music-bed-ducked.wav")} />
  </AbsoluteFill>
);
