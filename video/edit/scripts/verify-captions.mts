import { chunkCaptions, chunkAt } from "../src/captions/chunk";
import tokensRaw from "../public/voiceover/openreceipt-vo.captions.json";

const tokens = tokensRaw as { text: string; startMs: number; endMs: number }[];
const chunks = chunkCaptions();

console.log(`chunks: ${chunks.length}\n`);
for (const c of chunks) {
  console.log(`${(c.startMs / 1000).toFixed(2).padStart(6)} - ${(c.endMs / 1000).toFixed(2).padStart(6)}  ${JSON.stringify(c.text)}`);
}

let bad = 0;
for (const t of tokens) {
  const word = t.text.trim().replace(/[.,!?;:'"]/g, "");
  if (word.length < 3) continue;
  const mid = (t.startMs + t.endMs) / 2;
  const c = chunkAt(chunks, mid);
  if (!c) { console.log(`GAP at ${mid}ms for ${JSON.stringify(t.text)}`); bad++; continue; }
  const hay = c.text.replace(/[.,!?;:'"]/g, "").toLowerCase();
  if (!hay.includes(word.toLowerCase())) {
    if (/^(open|re|ce|ipt|web|m|cp)$/i.test(word)) continue;
    console.log(`MISMATCH ${mid}ms token=${JSON.stringify(t.text)} chunk=${JSON.stringify(c.text)}`);
    bad++;
  }
}
console.log(`\ncoverage mismatches: ${bad}`);
console.log(`longest chunk: ${chunks.reduce((a, c) => Math.max(a, c.text.length), 0)} chars`);
