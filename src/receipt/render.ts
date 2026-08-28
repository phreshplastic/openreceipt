import { receiptDocumentSchema, type ReceiptBlock, type ReceiptDocumentV1 } from "./model";

export const RENDERER_VERSION = "receipt-svg-v1";

export type BlockGeometry = {
  id: string;
  type: ReceiptBlock["type"];
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RenderedReceipt = {
  svg: string;
  width: number;
  height: number;
  rendererVersion: string;
  blocks: BlockGeometry[];
};

type TextStyle = { size: number; lineHeight: number; weight: number; tracking?: number };
type SvgPart = { markup: string; height: number };

const styles = {
  display: { size: 36, lineHeight: 42, weight: 790, tracking: -0.7 },
  heading: { size: 28, lineHeight: 34, weight: 740, tracking: -0.35 },
  section: { size: 21, lineHeight: 27, weight: 720, tracking: 0.4 },
  large: { size: 24, lineHeight: 32, weight: 450 },
  body: { size: 20, lineHeight: 27, weight: 440 },
  small: { size: 16, lineHeight: 22, weight: 480, tracking: 0.15 },
} satisfies Record<string, TextStyle>;

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

function estimatedWidth(text: string, style: TextStyle) {
  const weightAdjustment = style.weight >= 700 ? 0.59 : 0.54;
  return [...text].reduce((width, character) => {
    if (/[MW@#%]/.test(character)) return width + style.size * 0.83;
    if (/[A-Z]/.test(character)) return width + style.size * 0.66;
    if (/[ilI1.,:;!' ]/.test(character)) return width + style.size * 0.3;
    return width + style.size * weightAdjustment;
  }, 0);
}

export function wrapText(text: string, maxWidth: number, style: TextStyle) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if ((!line && estimatedWidth(word, style) <= maxWidth) || (line && estimatedWidth(next, style) <= maxWidth)) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      if (estimatedWidth(word, style) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = "";
      for (const character of word) {
        if (fragment && estimatedWidth(fragment + character, style) > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else fragment += character;
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function attributes(style: TextStyle, weight = style.weight) {
  return `font-family="Inter,Arial,sans-serif" font-size="${style.size}" font-weight="${weight}" letter-spacing="${style.tracking ?? 0}" fill="#000"`;
}

function anchor(align: "left" | "center" | "right", width: number) {
  if (align === "center") return { x: width / 2, value: "middle" };
  if (align === "right") return { x: width, value: "end" };
  return { x: 0, value: "start" };
}

function renderText(text: string, width: number, style: TextStyle, align: "left" | "center" | "right", weight = style.weight): SvgPart {
  const lines = wrapText(text, width, { ...style, weight });
  const position = anchor(align, width);
  const markup = lines.map((line, index) => `<text x="${position.x}" y="${style.size + index * style.lineHeight}" text-anchor="${position.value}" ${attributes(style, weight)}>${escapeXml(line)}</text>`).join("");
  return { markup, height: Math.max(style.lineHeight, lines.length * style.lineHeight) };
}

function blockPart(block: ReceiptBlock, width: number): SvgPart {
  if (block.type === "heading") {
    const style = styles[block.level];
    return renderText(block.text, width, style, block.align);
  }

  if (block.type === "text") {
    const style = styles[block.size];
    const weight = block.weight === "bold" ? 720 : block.weight === "medium" ? 590 : style.weight;
    return renderText(block.text, width, style, block.align, weight);
  }

  if (block.type === "divider") {
    const dash = block.style === "dashed" ? ' stroke-dasharray="8 7"' : "";
    return { markup: `<line x1="0" y1="10" x2="${width}" y2="10" stroke="#000" stroke-width="2"${dash}/>`, height: 20 };
  }

  if (block.type === "checklist") {
    let y = 0;
    let markup = "";
    for (const item of block.items) {
      const lines = wrapText(item.text, width - 42, styles.body);
      const rowHeight = Math.max(34, lines.length * styles.body.lineHeight + 8);
      const boxY = y + 5;
      markup += `<rect x="0" y="${boxY}" width="22" height="22" rx="2" fill="${item.checked ? "#000" : "#fff"}" stroke="#000" stroke-width="2"/>`;
      if (item.checked) markup += `<path d="M5 ${boxY + 11} l5 5 l9 -11" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      markup += lines.map((line, index) => `<text x="38" y="${y + styles.body.size + index * styles.body.lineHeight}" ${attributes(styles.body)}>${escapeXml(line)}</text>`).join("");
      y += rowHeight;
    }
    return { markup, height: Math.max(30, y) };
  }

  if (block.type === "keyValue") {
    let y = 0;
    let markup = "";
    block.rows.forEach((row, index) => {
      const weight = row.emphasis ? 730 : styles.body.weight;
      const labelWidth = estimatedWidth(row.label, { ...styles.body, weight });
      const valueWidth = estimatedWidth(row.value, { ...styles.body, weight });
      const stacked = labelWidth + valueWidth > width - 24;
      const rowHeight = stacked ? 58 : 36;
      markup += `<text x="0" y="${y + styles.body.size}" ${attributes(styles.body, weight)}>${escapeXml(row.label)}</text>`;
      markup += `<text x="${stacked ? 0 : width}" y="${y + styles.body.size + (stacked ? 27 : 0)}" text-anchor="${stacked ? "start" : "end"}" ${attributes(styles.body, weight)}>${escapeXml(row.value)}</text>`;
      y += rowHeight;
      if (block.dividers && index < block.rows.length - 1) markup += `<line x1="0" y1="${y - 5}" x2="${width}" y2="${y - 5}" stroke="#000" stroke-width="1" opacity=".45"/>`;
    });
    return { markup, height: Math.max(30, y) };
  }

  let y = 0;
  let markup = "";
  const columnWidth = width / block.columns;
  block.rows.forEach((row, rowIndex) => {
    const lineSets = row.cells.slice(0, block.columns).map((cell) => wrapText(cell, columnWidth - 16, styles.small));
    const rowHeight = Math.max(31, ...lineSets.map((lines) => lines.length * styles.small.lineHeight + 8));
    row.cells.slice(0, block.columns).forEach((cell, columnIndex) => {
      const lines = lineSets[columnIndex];
      const weight = block.header && rowIndex === 0 ? 720 : styles.small.weight;
      markup += lines.map((line, lineIndex) => `<text x="${columnIndex * columnWidth + 7}" y="${y + styles.small.size + 4 + lineIndex * styles.small.lineHeight}" ${attributes(styles.small, weight)}>${escapeXml(line)}</text>`).join("");
    });
    markup += `<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="none" stroke="#000" stroke-width="1"/>`;
    for (let column = 1; column < block.columns; column += 1) markup += `<line x1="${column * columnWidth}" y1="${y}" x2="${column * columnWidth}" y2="${y + rowHeight}" stroke="#000" stroke-width="1"/>`;
    y += rowHeight;
  });
  return { markup, height: Math.max(30, y) };
}

function spacingAfter(block: ReceiptBlock, next?: ReceiptBlock) {
  if (!next) return 0;
  if (block.type === "heading" && next.type === "text") return 10;
  if (block.type === "divider") return 14;
  if (next.type === "divider") return 16;
  return 20;
}

export function renderReceiptSvg(input: ReceiptDocumentV1): RenderedReceipt {
  const document = receiptDocumentSchema.parse(input);
  const width = document.page.printableWidthDots;
  const padding = document.page.paddingDots;
  const contentWidth = width - padding * 2;
  const rendered = document.blocks.map((block) => blockPart(block, contentWidth));
  const blocks: BlockGeometry[] = [];
  let y = padding;
  let body = "";

  document.blocks.forEach((block, index) => {
    const part = rendered[index];
    blocks.push({ id: block.id, type: block.type, x: padding, y, width: contentWidth, height: part.height });
    body += `<g data-block-id="${escapeXml(block.id)}" transform="translate(${padding} ${y})">${part.markup}</g>`;
    y += part.height + spacingAfter(block, document.blocks[index + 1]);
  });

  const height = Math.max(120, Math.ceil(y + padding));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(document.title)}"><rect width="${width}" height="${height}" fill="#fff"/>${body}</svg>`;
  return { svg, width, height, rendererVersion: RENDERER_VERSION, blocks };
}
