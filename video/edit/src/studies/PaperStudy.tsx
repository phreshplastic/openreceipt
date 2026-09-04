import React from "react";
import { AbsoluteFill } from "remotion";
import { palette, font, type } from "../theme";
import { Sheet, Strip, Grain, PaperFilters, PARCHMENT_VARIANTS, THERMAL_VARIANTS } from "../paper";
import { fontsReady } from "../fonts";

void fontsReady;

/**
 * Look test, not a shot. Four parchment stocks and two receipt stocks at the size
 * they will actually appear, so the choice gets made on evidence rather than on a
 * swatch. Read this at 100%: paper that survives a thumbnail often dies at full
 * size, and the reverse.
 */
export const PaperStudy: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#cdc6b6" }}>
    <PaperFilters />

    <div style={{ position: "absolute", inset: 0, display: "flex", gap: 44, padding: "72px 60px 0" }}>
      {PARCHMENT_VARIANTS.map((variant, index) => (
        <div key={variant.id} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontFamily: font.text,
              fontSize: type.caption.size,
              fontWeight: type.caption.weight,
              color: palette.ink,
              letterSpacing: -0.2,
            }}
          >
            {variant.label}
          </div>
          <Sheet
            width={392}
            height={540}
            variant={variant.id}
            seed={index * 7 + 3}
            edges={
              index % 2 === 0
                ? { top: "cut", right: "torn", bottom: "torn", left: "cut" }
                : { top: "torn", right: "cut", bottom: "cut", left: "torn" }
            }
          >
            <div
              style={{
                position: "absolute",
                inset: "40px 34px",
                fontFamily: font.text,
                fontSize: 58,
                fontWeight: 800,
                color: palette.ink,
                letterSpacing: -2.2,
                lineHeight: 0.98,
              }}
            >
              Open<br />Receipt
            </div>
          </Sheet>
        </div>
      ))}
    </div>

    {/* Receipt stock laid on parchment — the one comparison that matters, because
        the film turns on a viewer reading these as two different materials. */}
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 372, overflow: "hidden" }}>
      <Sheet
        width={2100}
        height={520}
        variant="laid"
        seed={31}
        edges={{ top: "torn", right: "cut", bottom: "cut", left: "cut" }}
        rotate={-0.35}
        style={{ position: "absolute", left: -80, top: 0 }}
      />
      <div style={{ position: "absolute", left: 96, top: 62, display: "flex", gap: 96, alignItems: "flex-start" }}>
        {THERMAL_VARIANTS.map((stock, index) => (
          <div key={stock.id} style={{ display: "flex", gap: 26, alignItems: "flex-start" }}>
            <Strip width={300} height={290} variant={stock.id} seed={index * 11 + 2} curl={0.75} rotate={index === 0 ? -1.1 : 0.7}>
              <div
                style={{
                  position: "absolute",
                  inset: "24px 22px",
                  fontFamily: font.text,
                  color: "#000",
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontSize: 30, fontWeight: 760, letterSpacing: -0.4 }}>LISBON</div>
                <div style={{ fontWeight: 500, fontSize: 19 }}>Thursday · international</div>
                <div style={{ height: 2, background: "#000", margin: "14px 0" }} />
                <div style={{ fontWeight: 500, fontSize: 19 }}>Flight TP204 · 09:40</div>
                <div style={{ fontWeight: 500, fontSize: 19 }}>Seat 14A</div>
              </div>
            </Strip>
            <div
              style={{
                width: 210,
                fontFamily: font.text,
                fontSize: 22,
                fontWeight: 560,
                color: palette.graphite,
                paddingTop: 6,
              }}
            >
              {stock.label}
            </div>
          </div>
        ))}
      </div>
    </div>

    <Grain />
  </AbsoluteFill>
);
