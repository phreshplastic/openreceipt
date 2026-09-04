import React from "react";
import { AbsoluteFill } from "remotion";
import { palette, font } from "../theme";
import { assets } from "../timing";

/**
 * A labelled slate standing in for footage that has not been shot yet.
 *
 * It names the exact asset ID and the file the capture manifest expects, so a
 * missing shot is visible in a render instead of quietly becoming a design
 * decision. Never dress these up: a placeholder that looks finished is how fake
 * evidence gets into a cut.
 */
export const Placeholder: React.FC<{
  readonly assetId: string;
  readonly note?: string;
}> = ({ assetId, note }) => (
  <AbsoluteFill
    style={{
      backgroundColor: palette.backdropDeep,
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
      backgroundImage:
        "repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 22px, rgba(255,255,255,0) 22px 44px)",
    }}
  >
    <div
      style={{
        fontFamily: font.text,
        fontSize: 26,
        fontWeight: 620,
        letterSpacing: 3,
        color: palette.pencil,
        textTransform: "uppercase",
      }}
    >
      Missing capture
    </div>
    <div style={{ fontFamily: font.text, fontSize: 62, fontWeight: 700, color: palette.paper, letterSpacing: -1.4 }}>
      {assetId}
    </div>
    <div style={{ fontFamily: font.text, fontSize: 26, fontWeight: 500, color: palette.pencil }}>
      {assets[assetId] ?? "not listed in shot-plan.json"}
    </div>
    {note ? (
      <div style={{ fontFamily: font.text, fontSize: 24, fontWeight: 500, color: palette.graphite, maxWidth: 900, textAlign: "center" }}>
        {note}
      </div>
    ) : null}
  </AbsoluteFill>
);
