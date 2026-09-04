/**
 * Generates the OpenReceipt narration as one continuous ElevenLabs v3 take.
 *
 * One take, not six stitched clips: v3's delivery is tonally continuous within a
 * single generation, and concatenating separate lines produces audible seams at
 * every join. Whisper (transcribe-voiceover.mts) recovers per-line timestamps
 * from this single file afterward, so nothing about scene-cutting is lost by
 * generating it whole.
 *
 * Reads the key from video/edit/.env (gitignored) rather than the shell
 * environment, so it never has to be pasted into a chat transcript.
 *
 *   node --experimental-strip-types scripts/generate-voiceover.mts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(resolve(root, ".env"));

const VOICE_ID = "UgBBYS2sOqTuMpoF3BR0";
const MODEL_ID = "eleven_v3";
const SCRIPT_PATH = resolve(root, "../assets/audio/vo-script.txt");
const OUTPUT_PATH = resolve(root, "public/voiceover/openreceipt-vo.mp3");

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error(
    `No ELEVENLABS_API_KEY found.\n\nCreate ${resolve(root, ".env")} (already gitignored) containing:\n\n  ELEVENLABS_API_KEY=sk_your_key_here\n\nthen re-run this script.`,
  );
  process.exit(1);
}

const text = readFileSync(SCRIPT_PATH, "utf8").trim();

// No SSML break tags — eleven_v3 does not support them. Pacing comes from plain
// punctuation in vo-script.txt (commas/periods, no dashes or ellipses), which is
// what the model's own docs recommend to avoid overlong "pregnant" pauses. Add a
// literal "[pause]" or "[short pause]" tag directly into vo-script.txt at a
// specific spot only if a real gap turns out to be needed after listening — do
// not add them speculatively.
const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
  method: "POST",
  headers: {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "audio/mpeg",
  },
  body: JSON.stringify({
    text,
    model_id: MODEL_ID,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35 },
  }),
});

if (!response.ok) {
  console.error(`ElevenLabs returned ${response.status}: ${await response.text()}`);
  process.exit(1);
}

writeFileSync(OUTPUT_PATH, Buffer.from(await response.arrayBuffer()));
console.log(`Wrote ${OUTPUT_PATH}`);
