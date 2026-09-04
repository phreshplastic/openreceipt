/**
 * Renders a saved receipt document to SVG and PNG for the demo film.
 *
 * The film shows the real receipt, so it renders through the product's own
 * renderer rather than a redrawing of it. Live blocks keep whatever data they
 * had when the document was captured, which is what a viewer saw on screen.
 *
 *   node --import tsx scripts/render-demo-receipt.mts <document.json> <out-basename>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { renderReceiptSvg } from "../src/receipt/render";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: render-demo-receipt.mts <document.json> <out-basename>");

const raw = JSON.parse(await readFile(resolve(input), "utf8"));
const document = raw.document ?? raw;
const rendered = renderReceiptSvg(document);

await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(`${resolve(output)}.svg`, rendered.svg);

const png = new Resvg(rendered.svg, { fitTo: { mode: "width", value: rendered.width } }).render().asPng();
await writeFile(`${resolve(output)}.png`, png);

// Per-block geometry, so the film can reveal blocks one at a time and punch to a
// named block using the receipt's own coordinates rather than hand-measured ones.
await writeFile(
  `${resolve(output)}.geometry.json`,
  `${JSON.stringify(
    {
      width: rendered.width,
      height: rendered.height,
      blocks: rendered.blocks.map((block, index) => ({
        index,
        id: block.id,
        kind: document.blocks[index]?.kind ?? document.blocks[index]?.type,
        y: block.y,
        height: block.height,
      })),
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(
  `${document.title}: ${rendered.width} x ${rendered.height} dots, ${rendered.blocks.length} blocks\n`,
);
