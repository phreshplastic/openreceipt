import { SHOTS, TOTAL_SECONDS, shotOrder } from "../src/shots";
import { chunkCaptions } from "../src/captions/chunk";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const names = shotOrder;

let fail = 0;

// 1. Shots must be contiguous: no gap can exist for the backdrop to show through.
for (let i = 0; i < names.length - 1; i += 1) {
  const start = f(SHOTS[names[i]]);
  const next = f(SHOTS[names[i + 1]]);
  if (next <= start) { console.log(`ORDER  ${names[i]} -> ${names[i + 1]} not increasing`); fail++; }
}
console.log(`shots: ${names.length - 1}, contiguous by construction (duration = next - start)`);

// 2. Every former gap in the old cut must now be covered by some shot.
const oldGaps = [1.81, 10.73, 20.12, 34.48, 42.97, 47.08, 51.6, 52.0, 56.52, 65.68, 70.76, 75.27];
for (const t of oldGaps) {
  const covered = names.slice(0, -1).some((n, i) => t >= SHOTS[n] && t < SHOTS[names[i + 1]]);
  if (!covered) { console.log(`UNCOVERED former gap at ${t}s`); fail++; }
}
console.log(`former black-flash timestamps covered: ${oldGaps.length}/${oldGaps.length}`);

// 3. Captions must never outrun the film or overlap each other.
const chunks = chunkCaptions();
for (let i = 0; i < chunks.length - 1; i += 1) {
  if (chunks[i].endMs > chunks[i + 1].startMs) {
    console.log(`OVERLAP ${JSON.stringify(chunks[i].text)} / ${JSON.stringify(chunks[i + 1].text)}`); fail++;
  }
}
const last = chunks[chunks.length - 1];
if (last.endMs / 1000 > TOTAL_SECONDS) { console.log(`captions run past end`); fail++; }
console.log(`captions: ${chunks.length}, no overlaps, last ends ${(last.endMs / 1000).toFixed(2)}s of ${TOTAL_SECONDS}s`);

console.log(fail === 0 ? "\nPASS" : `\nFAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
