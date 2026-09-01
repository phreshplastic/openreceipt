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
  display: { size: 36, lineHeight: 42, weight: 790, tracking: -0.7 },
  heading: { size: 28, lineHeight: 34, weight: 740, tracking: -0.35 },
  section: { size: 21, lineHeight: 27, weight: 720, tracking: 0.4 },
  large: { size: 24, lineHeight: 32, weight: 450 },
  body: { size: 20, lineHeight: 27, weight: 440 },
  small: { size: 16, lineHeight: 22, weight: 480, tracking: 0.15 },
  label: { size: 13, lineHeight: 18, weight: 720, tracking: 1.1 },
  numeric: { size: 34, lineHeight: 39, weight: 760, tracking: -0.4 },
} satisfies Record<string, TextStyle>;

export const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export function estimatedWidth(text: string, style: TextStyle) {
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

export function textAttributes(style: TextStyle, weight = style.weight, effects: { italic?: boolean; underline?: boolean } = {}) {
  return `font-family="Inter,Arial,sans-serif" font-size="${style.size}" font-weight="${weight}" font-style="${effects.italic ? "italic" : "normal"}" text-decoration="${effects.underline ? "underline" : "none"}" letter-spacing="${style.tracking ?? 0}" fill="#000"`;
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
