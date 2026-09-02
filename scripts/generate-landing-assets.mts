import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createLandingDemo } from "../src/pages/landing-demo";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public/generated");
const demo = createLandingDemo();
const sampleNames = ["checklists", "countdowns", "habit-weeks", "meeting-notes"];

await mkdir(output, { recursive: true });
await writeFile(resolve(output, "landing-hero.svg"), demo.hero.svg);
await Promise.all(demo.samples.map((sample, index) =>
  writeFile(resolve(output, `landing-${sampleNames[index]}.svg`), sample.rendered.svg),
));
const printerPath = resolve(root, "src/assets/tm-l90.png");
await copyFile(printerPath, resolve(output, "tm-l90.png"));
await copyFile(resolve(root, "src/assets/scenes/run-2048.webp"), resolve(output, "hero-run.webp"));

const printerData = (await readFile(printerPath)).toString("base64");
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f5f7"/>
  <circle cx="1000" cy="84" r="330" fill="#e5e6e8"/>
  <text x="82" y="120" fill="#0071e3" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700">OPENRECEIPT</text>
  <text x="82" y="232" fill="#1d1d1f" font-family="Inter,Arial,sans-serif" font-size="66" font-weight="760">Make a little something</text>
  <text x="82" y="310" fill="#1d1d1f" font-family="Inter,Arial,sans-serif" font-size="66" font-weight="760">with your thermal printer.</text>
  <text x="84" y="382" fill="#6e6e73" font-family="Inter,Arial,sans-serif" font-size="27">A local-first receipt editor for people and AI agents.</text>
  <image href="data:image/png;base64,${printerData}" x="790" y="110" width="360" height="470" preserveAspectRatio="xMidYMid meet"/>
  <rect x="82" y="498" width="232" height="52" rx="26" fill="#0071e3"/>
  <text x="198" y="532" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="650">EPSON TM-L90</text>
</svg>`;
const og = new Resvg(card, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
await writeFile(resolve(output, "og.png"), og);
