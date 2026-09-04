/**
 * Transcribes the approved VO locally with Whisper.cpp to get word-level
 * timestamps — the real timing source for captions and scene cuts. No cut,
 * caption, or hold duration in the film is ever hand-guessed; it comes from
 * where a word actually lands in this file.
 *
 *   node --experimental-strip-types scripts/transcribe-voiceover.mts
 */
import path from "node:path";
import fs from "node:fs";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const whisperDir = path.join(root, "whisper.cpp");
const input = path.join(root, "public/voiceover/openreceipt-vo.wav");
const output = path.join(root, "public/voiceover/openreceipt-vo.captions.json");

await installWhisperCpp({ to: whisperDir, version: "1.5.5" });
await downloadWhisperModel({ model: "medium.en", folder: whisperDir });

const whisperCppOutput = await transcribe({
  model: "medium.en",
  whisperPath: whisperDir,
  whisperCppVersion: "1.5.5",
  inputPath: input,
  tokenLevelTimestamps: true,
});

const { captions } = toCaptions({ whisperCppOutput });
fs.writeFileSync(output, JSON.stringify(captions, null, 2));
console.log(`Wrote ${captions.length} caption tokens to ${output}`);
console.log(`Last word ends at ${(captions.at(-1)?.endMs ?? 0) / 1000}s`);
