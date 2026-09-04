import React from "react";
import { Composition, Folder, Still } from "remotion";
import { PaperStudy } from "./studies/PaperStudy";
import { DirectionConfirmed, DirectionEndCard, DirectionFramePair, DirectionReceipt } from "./studies/DirectionStudy";
import { Film, durationInFrames } from "./Film";
import { FilmV2, durationInFrames as durationV2 } from "./FilmV2";
import { FPS } from "./theme";

/**
 * `Film` is the real submission cut: one continuous narrated video built
 * against the approved, locked voiceover and real screen/physical capture. See
 * Film.tsx's own header comment for the timing model.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="FilmV2" component={FilmV2} width={1920} height={1080} fps={FPS} durationInFrames={durationV2} />
      <Composition id="Film" component={Film} width={1920} height={1080} fps={FPS} durationInFrames={durationInFrames} />
      <Folder name="Studies">
        <Still id="Paper-Study" component={PaperStudy} width={1920} height={1080} />
        <Still id="Direction-Confirmed" component={DirectionConfirmed} width={1920} height={1080} />
        <Still id="Direction-Frame-Pair" component={DirectionFramePair} width={1920} height={1080} />
        <Still id="Direction-Receipt" component={DirectionReceipt} width={1920} height={1080} />
        <Still id="Direction-End-Card" component={DirectionEndCard} width={1920} height={1080} />
      </Folder>
    </>
  );
};
