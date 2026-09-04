import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { palette, font } from "../theme";
import { PaperFilters, Grain } from "../paper";
import { Card } from "../plate/Card";
import { Label } from "../type/Label";
import { fontsReady } from "../fonts";

void fontsReady;

const CAPTION = "…a countdown, a packing list, even a surf forecast…";
const CAPTURE = "standin/03-editor-agent-draft.png";

/**
 * The confirmed direction: dark blue-tinted backdrop (works for both light-mode
 * product UI and colour-rich B-roll), real UI framed plainly, caption on a
 * rounded parchment card rather than receipt stock. This replaces the earlier
 * three-way comparison — A was picked, B/C's receipt-stock caption read as
 * "corny" and are retired.
 */
export const DirectionConfirmed: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: palette.backdrop }}>
    <PaperFilters />
    <Card src={CAPTURE} fill={0.78} />
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "flex-end", padding: "0 0 84px 110px" }}>
      <Label at={-1} size={38} style={{ maxWidth: 760 }}>{CAPTION}</Label>
    </AbsoluteFill>
    <Grain opacity={0.03} />
  </AbsoluteFill>
);

/**
 * Same frame language applied to a stand-in for Pete's phone shot of the
 * printer, side by side with a screen capture — proving the "shitty video
 * reads as intentional" idea before he goes and shoots it for real.
 */
export const DirectionFramePair: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: palette.backdrop }}>
    <PaperFilters />
    <AbsoluteFill style={{ flexDirection: "row" }}>
      <div style={{ position: "relative", width: "50%", height: "100%" }}>
        <Card src={CAPTURE} fill={0.86} variant="screen" backdrop={false} />
      </div>
      <div style={{ position: "relative", width: "50%", height: "100%" }}>
        <Card src="standin/05-printed.png" fill={0.86} variant="phone" backdrop={false} />
      </div>
    </AbsoluteFill>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", padding: "0 0 64px 0" }}>
      <Label at={-1} size={30}>Same frame, screen capture left, phone shot of the printer right.</Label>
    </AbsoluteFill>
    <Grain opacity={0.03} />
  </AbsoluteFill>
);

/**
 * The end-card treatment: real B-roll, the site's own hero recipe.
 *
 * Same technique as the landing page's `.moments-hero` — a full-bleed lifestyle
 * photo, a multi-stop dark scrim for legibility (the exact gradient values from
 * `src/styles.css`'s `.hero-experiment .moments-hero .moments-scrim`), and the
 * receipt itself sitting to one side with only a drop-shadow, no card chrome.
 * Reusing the product's own established look here rather than inventing a new
 * one for the film.
 */
export const DirectionEndCard: React.FC = () => (
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
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "flex-end", padding: "0 0 56px 90px" }}>
      <Label at={-1} size={30} style={{ maxWidth: 640 }}>
        End card: real street B-roll, the site&rsquo;s own hero scrim, the real receipt — no new visual language invented.
      </Label>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** The real, current receipt (rev 40) as it will actually appear in the film. */
export const DirectionReceipt: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: palette.backdrop }}>
    <PaperFilters />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Img
        src={staticFile("generated/surfing-trip.png")}
        style={{ height: 980, filter: "drop-shadow(0 1px 2px rgba(48,44,36,0.22)) drop-shadow(0 14px 26px rgba(48,44,36,0.22))" }}
      />
    </AbsoluteFill>
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-end", padding: "0 90px 90px 0" }}>
      <Label at={-1} size={34} style={{ maxWidth: 520 }}>
        <span style={{ fontFamily: font.text }}>The real, current receipt — Pete&rsquo;s Printer, solid rules, revision 40.</span>
      </Label>
    </AbsoluteFill>
    <Grain opacity={0.03} />
  </AbsoluteFill>
);
