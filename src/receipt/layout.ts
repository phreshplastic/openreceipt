import { fontAdvances } from "./font-metrics";

export type TextStyle = {
  size: number;
  lineHeight: number;
  weight: number;
  tracking?: number;
};

export type SvgPart = {
  markup: string;
  height: number;
  trailingSpace?: number;
};

export const thermalType = {
  display: { size: 40, lineHeight: 46, weight: 790, tracking: -0.7 },
  heading: { size: 30, lineHeight: 38, weight: 740, tracking: -0.35 },
  section: { size: 24, lineHeight: 30, weight: 720, tracking: 0.4 },
  large: { size: 28, lineHeight: 36, weight: 450 },
  body: { size: 24, lineHeight: 32, weight: 440 },
  small: { size: 18, lineHeight: 25, weight: 480, tracking: 0.15 },
  label: { size: 16, lineHeight: 21, weight: 720, tracking: .8 },
  numeric: { size: 34, lineHeight: 39, weight: 760, tracking: -0.4 },
} satisfies Record<string, TextStyle>;

/** The core list and grouped catalog list share the same paper geometry. */
export function renderChecklistRows(items: { text: string; checked?: boolean }[], width: number): SvgPart {
  let y = 0;
  let markup = "";
  for (const item of items) {
    const lines = wrapText(item.text, width - 42, thermalType.body);
    const boxY = y + 5;
    markup += `<rect x="0" y="${boxY}" width="22" height="22" rx="2" fill="${item.checked ? "#000" : "#fff"}" stroke="#000" stroke-width="2"/>`;
    if (item.checked) markup += `<path d="M5 ${boxY + 11} l5 5 l9 -11" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    markup += lines.map((line, index) => `<text x="38" y="${y + thermalType.body.size + index * thermalType.body.lineHeight}" ${textAttributes(thermalType.body)}>${escapeXml(line)}</text>`).join("");
    y += Math.max(34, lines.length * thermalType.body.lineHeight + 8);
  }
  return { markup, height: Math.max(30, y) };
}

export const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export function estimatedWidth(text: string, style: TextStyle) {
  const weight = Math.round(style.weight / 100) * 100;
  const advances: Record<string, number> = fontAdvances[weight >= 700 ? "bold" : weight >= 600 ? "medium" : "regular"];
  const weightAdjustment = style.weight >= 700 ? 0.59 : 0.54;
  return [...text].reduce((width, character) => {
    if (advances[character] !== undefined) return width + style.size * advances[character];
    if (/[MW@#%]/.test(character)) return width + style.size * 0.83;
    if (/[A-Z]/.test(character)) return width + style.size * 0.66;
    if (/[ilI1.,:;!' ]/.test(character)) return width + style.size * 0.3;
    return width + style.size * weightAdjustment;
  }, 0) + Math.max(0, [...text].length - 1) * (style.tracking ?? 0);
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

export function textAttributes(style: TextStyle, weight = style.weight, effects: { italic?: boolean; underline?: boolean } = {}) {
  // The printer renderer accepts SVG 1.1's 100-step weights, unlike browser CSS.
  const svgWeight = Math.max(100, Math.min(900, Math.round(weight / 100) * 100));
  return `font-family="Inter,Arial,sans-serif" font-size="${style.size}" font-weight="${svgWeight}" font-style="${effects.italic ? "italic" : "normal"}" text-decoration="${effects.underline ? "underline" : "none"}" letter-spacing="${style.tracking ?? 0}" fill="#000"`;
}

export function textAnchor(align: "left" | "center" | "right", width: number) {
  if (align === "center") return { x: width / 2, value: "middle" };
  if (align === "right") return { x: width, value: "end" };
  return { x: 0, value: "start" };
}

export function renderTextPart(text: string, width: number, style: TextStyle, align: "left" | "center" | "right", weight = style.weight, effects: { italic?: boolean; underline?: boolean } = {}): SvgPart {
  const lines = wrapText(text, width, { ...style, weight });
  const position = textAnchor(align, width);
  const markup = lines.map((line, index) => `<text x="${position.x}" y="${style.size + index * style.lineHeight}" text-anchor="${position.value}" ${textAttributes(style, weight, effects)}>${escapeXml(line)}</text>`).join("");
  return {
    markup,
    height: style.size + Math.max(0, lines.length - 1) * style.lineHeight,
    trailingSpace: Math.max(0, style.lineHeight - style.size),
  };
}
