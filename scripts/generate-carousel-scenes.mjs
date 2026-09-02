// Crops and encodes the landing carousel photographs.
//
// Not part of `npm run build` on purpose: it shells out to sips and cwebp, and the
// results are committed under src/assets/scenes. Re-run it only when the source
// photographs or the crop windows below change.
//
//   npm run assets:scenes
//
// Every scene ships one 16:9 crop at two widths. 16:9 covers all three stage shapes
// (21/9 desktop, 16/10 tablet, 4/5 phone) without ever cropping the sides on
// anything wider than a phone; the phone crop is steered per scene by the
// `objectPosition` recorded alongside the moment in src/pages/landing-demo.ts.
// Crop windows keep one side of the frame quiet, because the receipt sits there; which
// side that is varies per scene and is recorded as `placement` in src/pages/landing-demo.ts.

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const sources = join(root, "docs/potential-carousel-pics");
const output = join(root, "src/assets/scenes");

/** The carousel is at most 1072 CSS px wide, so 2048 covers it on a 2x display. */
const WIDTHS = [2048, 1024];
const QUALITY = 76;

/**
 * `crop` is a `{ x, y, width, height }` window in the source image's own pixels.
 * `quality` overrides the default for frames whose detail is expensive to encode.
 */
const SCENES = [
  { id: "morning", source: "pparnxoxo-uHVI29aSTVc-unsplash.jpg", crop: { x: 0, y: 120, width: 1920, height: 1080 } },
  { id: "run", source: "adam-davis-jQRxx47932o-unsplash.jpg", crop: { x: 0, y: 120, width: 1920, height: 1080 } },
  { id: "cook", source: "sincerely-media-R-J5t4aHj3I-unsplash.jpg", crop: { x: 0, y: 60, width: 1920, height: 1080 } },
  { id: "travel", source: "blake-wisz-TcgASSD5G04-unsplash.jpg", crop: { x: 0, y: 150, width: 1920, height: 1080 } },
  { id: "trail", source: "matt-whitacre-F4GGnyJ8aiI-unsplash.jpg", quality: 70, crop: { x: 0, y: 170, width: 1920, height: 1080 } },
];

async function requireBinary(name, formula) {
  try {
    await run("which", [name]);
  } catch {
    throw new Error(`${name} is required. Install it with \`brew install ${formula}\`.`);
  }
}

await requireBinary("sips", "n/a — sips ships with macOS");
await requireBinary("cwebp", "webp");
await mkdir(output, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "carousel-scenes-"));

try {
  for (const scene of SCENES) {
    const source = join(sources, scene.source);
    await stat(source);
    // Crop and resample have to be separate invocations: given both at once, sips
    // resamples first and the crop offsets then land in the wrong place.
    const cropped = join(scratch, `${scene.id}.png`);
    await run("sips", [
      "-c", String(scene.crop.height), String(scene.crop.width),
      "--cropOffset", String(scene.crop.y), String(scene.crop.x),
      "-s", "format", "png",
      source, "-o", cropped,
    ]);
    for (const width of WIDTHS) {
      const resampled = join(scratch, `${scene.id}-${width}.png`);
      const destination = join(output, `${scene.id}-${width}.webp`);
      await run("sips", ["--resampleWidth", String(width), cropped, "-o", resampled]);
      await run("cwebp", ["-q", String(scene.quality ?? QUALITY), "-sharp_yuv", "-m", "6", resampled, "-o", destination]);
      const { size } = await stat(destination);
      process.stdout.write(`${scene.id}-${width}.webp  ${(size / 1024).toFixed(0)} kB\n`);
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
