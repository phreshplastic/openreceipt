import tokens from "../../public/voiceover/openreceipt-vo.captions.json";
import sentences from "../../public/voiceover/openreceipt-vo.sentences.json";

export type Token = { readonly text: string; readonly startMs: number; readonly endMs: number };
export type Chunk = { readonly text: string; readonly startMs: number; readonly endMs: number };

/**
 * Whisper heard the audio correctly but spells a few things its own way. The
 * approved script is the authority for what the words ARE; the tokens are the
 * authority for WHEN they are said. Only spelling and punctuation are corrected
 * here — never timing, and never wording.
 */
const REPAIRS: readonly (readonly [RegExp, string])[] = [
  [/Open\s*Re\s*ce\s*ipt/g, "OpenReceipt"],
  [/\bWeb\s*M\s*CP\b/g, "WebMCP"],
  // The closing line is transcribed "OpenReceipt?"; the script says "OpenReceipt."
  [/OpenReceipt\?/g, "OpenReceipt."],
  [/—/g, "–"],
];

const repair = (text: string) => REPAIRS.reduce((out, [find, put]) => out.replace(find, put), text);

/** Roughly one comfortable line at the caption's type size. */
const MAX_CHARS = 36;

const isPunctuationOnly = (text: string) => /^[^\p{L}\p{N}]+$/u.test(text.trim());

/**
 * Group word tokens into readable caption chunks.
 *
 * Chunks never span a spoken sentence, and within a sentence the words are
 * split into a whole number of near-equal lines rather than greedily filled.
 * Greedy filling is what produces stranded one-word captions ("trip.", "the
 * day.") after a full line, which read as glitches. Balancing keeps every
 * caption a similar weight.
 *
 * Token `text` carries its own leading space, so pieces are concatenated
 * directly — joining with a space would double them and split contractions
 * like "'s" from their word. Punctuation-only tokens always attach to the
 * chunk they follow; they must never open one.
 */
export function chunkCaptions(source: readonly Token[] = tokens as readonly Token[]): Chunk[] {
  const bounds = (sentences as readonly { endMs: number }[]).map((s) => s.endMs);
  const groups: Token[][] = [];
  let current: Token[] = [];

  for (const token of source) {
    current.push(token);
    if (bounds.includes(token.endMs)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  // A sentence's closing "." is timed just past the sentence boundary, so it
  // lands at the head of the next group and would open a caption with a full
  // stop. Hand it back to the sentence it actually terminates.
  for (let index = 1; index < groups.length; index += 1) {
    while (groups[index].length > 0 && isPunctuationOnly(groups[index][0].text)) {
      groups[index - 1].push(groups[index].shift() as Token);
    }
  }

  return groups.filter((group) => group.length > 0).flatMap(splitSentence);
}

/** Split one sentence into near-equal lines, breaking at clause edges where possible. */
function splitSentence(group: readonly Token[]): Chunk[] {
  const total = group.reduce((sum, t) => sum + t.text.length, 0);
  const lines = Math.max(1, Math.ceil(total / MAX_CHARS));
  const target = total / lines;

  const chunks: Chunk[] = [];
  let text = "";
  let startMs = group[0]?.startMs ?? 0;
  let endMs = startMs;
  let remaining = lines;

  const flush = () => {
    const trimmed = repair(text).trim();
    if (trimmed.length > 0) chunks.push({ text: trimmed, startMs, endMs });
    text = "";
    remaining -= 1;
  };

  for (let index = 0; index < group.length; index += 1) {
    const token = group[index];
    if (text === "") startMs = token.startMs;
    text += token.text;
    endMs = token.endMs;

    const next = group[index + 1];
    if (!next) break;

    // Two things must never start a caption: punctuation, and the tail of a
    // word already begun. A token with no leading space continues the previous
    // one — "you"+"'ll", "local-"+"first", "Open"+"Re"+"ce"+"ipt" — so breaking
    // there would tear a word in half.
    if (isPunctuationOnly(next.text) || !/^\s/.test(next.text)) continue;

    const length = text.trim().length;
    const clauseEdge = /[,;:–—]$/.test(token.text.trim());
    const enough = length >= target * (clauseEdge ? 0.72 : 0.98);

    if (remaining > 1 && enough) flush();
  }
  flush();

  return chunks;
}

/** The chunk being spoken at a given millisecond, or null in a gap. */
export function chunkAt(chunks: readonly Chunk[], ms: number): Chunk | null {
  return chunks.find((c) => ms >= c.startMs && ms < c.endMs) ?? null;
}
