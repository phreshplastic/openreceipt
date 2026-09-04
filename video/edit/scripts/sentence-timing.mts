/**
 * Reduces the word-level whisper captions to per-sentence start/end times.
 *
 * This is the real timing source for shot-plan.json's sequences — no cut point
 * in the film is ever hand-guessed.
 *
 * Matches by concatenated-letters substring search rather than token-for-token
 * equality, because Whisper does not tokenize the same way the script is
 * written: it split "OpenClaw" into three separate tokens ("Open"/"Cl"/"aw").
 * A per-token matcher stalls forever on that kind of split and silently
 * consumes the rest of the file; a substring search over the concatenated
 * letter stream is correct regardless of how any one word got tokenized.
 *
 *   node --experimental-strip-types scripts/sentence-timing.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const captions = JSON.parse(
  readFileSync(path.join(root, "public/voiceover/openreceipt-vo.captions.json"), "utf8"),
) as { text: string; startMs: number; endMs: number }[];
const script = readFileSync(path.join(root, "../assets/audio/vo-script.txt"), "utf8");

const sentences = script
  .split(/\n+/)
  .filter((line) => line.trim())
  .flatMap((paragraph) => paragraph.match(/[^.]+\./g) ?? [paragraph])
  .map((s) => s.trim());

const onlyLetters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

// Flatten every caption token into one letters-only string, with a parallel
// array mapping each character back to the ms range of the token it came from.
let flat = "";
const charMs: { startMs: number; endMs: number }[] = [];
for (const c of captions) {
  const letters = onlyLetters(c.text);
  for (const _ of letters) charMs.push({ startMs: c.startMs, endMs: c.endMs });
  flat += letters;
}

let cursor = 0;
const results: { text: string; startMs: number; endMs: number }[] = [];
for (const sentence of sentences) {
  const wanted = onlyLetters(sentence);
  if (!wanted) continue;
  const at = flat.indexOf(wanted, cursor);
  if (at === -1) {
    console.error(`NO MATCH from char ${cursor}: "${sentence}"`);
    continue;
  }
  const endCharIdx = at + wanted.length - 1;
  results.push({
    text: sentence,
    startMs: charMs[at].startMs,
    endMs: charMs[endCharIdx].endMs,
  });
  cursor = endCharIdx + 1;
}

writeFileSync(
  path.join(root, "public/voiceover/openreceipt-vo.sentences.json"),
  JSON.stringify(results, null, 2),
);
for (const r of results) {
  console.log(`${(r.startMs / 1000).toFixed(2)}s - ${(r.endMs / 1000).toFixed(2)}s  ${r.text}`);
}
console.log(`\n${results.length}/${sentences.length} sentences matched.`);
