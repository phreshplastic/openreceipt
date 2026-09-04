import plan from "./shot-plan.json";
import { FPS } from "./theme";

/**
 * One sequence of the narrated film, timed to a real sentence in the approved
 * voiceover — see video/assets/audio/vo-script.txt and
 * public/voiceover/openreceipt-vo.sentences.json, the actual source of every
 * `start`/`end` value below. Nothing here is a guess.
 */
export type Sequence = {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly sentence: string;
  readonly primaryAssets: readonly string[];
  readonly visual: string;
  readonly proof: string;
  readonly caution?: string;
};

export const sequences = plan.sequences as readonly Sequence[];

export const assets = plan.assets as Readonly<Record<string, string>>;

export const sequence = (id: string): Sequence => {
  const found = sequences.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown sequence "${id}". Sequence ids live in shot-plan.json.`);
  return found;
};

export const frames = (seconds: number) => Math.round(seconds * FPS);

export const startFrame = (id: string) => frames(sequence(id).start);
export const durationFrames = (id: string) => frames(sequence(id).end - sequence(id).start);

export const FILM_DURATION = frames(plan.format.targetDurationSeconds);
export const FILM_MAX_DURATION = frames(plan.format.maximumDurationSeconds);

/** The real voiceover's own duration — the true length of the cut, full stop. */
export const VO_DURATION_SECONDS = plan.audio.voDurationSeconds;
export const VO_DURATION_FRAMES = frames(VO_DURATION_SECONDS);
