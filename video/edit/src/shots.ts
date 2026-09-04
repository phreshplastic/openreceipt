/**
 * The cut, as a single ordered list of start times in seconds.
 *
 * A shot's duration is always "until the next shot starts", so gaps cannot
 * exist by construction. This matters: the previous cut placed each shot on its
 * voiceover sentence and left the pauses between sentences empty, which is what
 * made the film flash its backdrop on eleven cuts.
 *
 * Kept free of Remotion imports so the structure can be verified without a
 * bundler — see scripts/verify-film.mts.
 */
export const SHOTS = {
  hero: 0,
  prompt: 2.14,
  draftLands: 10.81,
  tools: 15.11,
  receiptDetail: 20.24,
  followUp: 28.06,
  agentEdit: 34.72,
  preview: 43.2,
  approve: 47.28,
  printing: 49.6,
  breadth: 56.64,
  tear: 65.92,
  badges: 70.88,
  endCard: 75.31,
  end: 81,
} as const;

export type ShotName = keyof typeof SHOTS;
export const shotOrder = Object.keys(SHOTS) as ShotName[];

export const TOTAL_SECONDS = SHOTS.end;
