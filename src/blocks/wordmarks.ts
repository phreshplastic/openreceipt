import { escapeXml, estimatedWidth } from "../receipt/layout";
import { SIGN_FAMILY, SIGN_FONT_DATA_URI } from "./sign-font";
import { SIGN_ADVANCES, SIGN_CAP_HEIGHT, SIGN_FALLBACK_ADVANCE } from "./sign-metrics";

/**
 * Curated shop signs. Every mark is drawn from the same name, so a person can try
 * all six against their own and keep the one that fits. What differs is the form —
 * an arch, a bar, a rule pair — never a slogan.
 *
 * These deliberately avoid the app's UI face. A receipt is rasterised through an
 * <img>, where a web font would not load, so each mark is built from families a
 * machine already has — the preview and the paper then agree.
 */
export type WordmarkStyleId =
  | "owners-printer-western"
  | "kitchen-dispatch"
  | "masthead-press"
  | "mono-ticket"
  | "oval-badge"
  | "block-modern";

export type WordmarkSize = "small" | "medium" | "large";

export const wordmarkSizeIds: readonly WordmarkSize[] = ["small", "medium", "large"];
export const defaultWordmarkSize: WordmarkSize = "medium";

export type LogoData = {
  style: WordmarkStyleId;
  primary: string;
  secondary?: string;
  /**
   * How much of the paper's width the mark claims. Medium reads as a sign, not a billboard.
   *
   * Required, not optional: the stored schema declares `.default("medium")`, so every value
   * that has been through `receiptDocumentSchema` carries a size. An optional field here
   * would describe a shape the parser never produces, and the two would disagree at every
   * boundary between a parsed block and a constructed one.
   */
  size: WordmarkSize;
};

export type WordmarkStyle = {
  id: WordmarkStyleId;
  name: string;
  description: string;
  /** What this mark reads by default, given whatever name we know. */
  suggest(firstName: string): { primary: string; secondary: string };
};

type Part = { markup: string; height: number };

/**
 * Per-family metrics, measured rather than guessed: `width` corrects estimatedWidth,
 * which is calibrated for the UI sans, and `cap` is the cap height in ems. Both come
 * from rendering one alphabet and two and taking the difference, so side bearings
 * cancel and what is left is real advance width.
 *
 * Marks are set in caps, so cap height — not the em box — sets every gap, rule and
 * block height here. That is what keeps the vertical rhythm tight.
 */
type Face = { family: string; width: number; cap: number; advance?: number; advances?: Record<string, number> };

/**
 * The arch is set in a subsetted Ultra (Apache 2.0, see the licence beside the file),
 * renamed so a machine that happens to have the original installed still draws the one
 * we measured. It rides inside the SVG as a data URI: a receipt is rasterised through
 * an <img>, which cannot reach a stylesheet, so the font has to travel with it.
 */
const SIGN: Face = { family: `${SIGN_FAMILY},Georgia,serif`, width: 1, cap: SIGN_CAP_HEIGHT, advances: SIGN_ADVANCES };

/** Emitted into any SVG that draws a mark in the sign face, and only those. */
export function signFontFace() {
  return `<defs><style>@font-face{font-family:"${SIGN_FAMILY}";font-style:normal;font-weight:400;src:url(${SIGN_FONT_DATA_URI}) format("truetype");}</style></defs>`;
}

export const usesSignFace = (markup: string) => markup.includes(SIGN_FAMILY);

/** The same face as raw bytes, for renderers that resolve fonts by family rather than @font-face. */
export function signFontBytes() {
  const base64 = SIGN_FONT_DATA_URI.slice(SIGN_FONT_DATA_URI.indexOf(",") + 1);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

const SERIF: Face = { family: "Georgia,'Times New Roman',Times,serif", width: 1.143, cap: 0.693 };
const SANS: Face = { family: "'Helvetica Neue',Helvetica,Arial,sans-serif", width: 1.025, cap: 0.714 };
const HEAVY: Face = { family: "'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif", width: 1.143, cap: 0.716 };
const CONDENSED: Face = { family: "'Arial Narrow',Impact,'Helvetica Neue',Helvetica,Arial,sans-serif", width: 0.838, cap: 0.716 };
// Courier sets every glyph on one 0.6 em advance, so it is measured by character count.
const MONO: Face = { family: "'Courier New',Courier,monospace", width: 1, cap: 0.592, advance: 0.6 };

const round = (value: number) => Math.round(value * 100) / 100;

export function possessive(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return `${trimmed}${/s$/i.test(trimmed) ? "’" : "’s"}`;
}

/** Width of one line set at size 1, so a target width converts straight to a size. */
function unitWidth(value: string, face: Face, tracking: number) {
  const glyphs = face.advances
    ? [...value].reduce((total, character) => total + (face.advances![character] ?? SIGN_FALLBACK_ADVANCE), 0)
    : face.advance
      ? [...value].length * face.advance
      // estimatedWidth only knows the straight quote; a typographic one is just as narrow.
      : estimatedWidth(value.replace(/’/g, "'"), { size: 1, lineHeight: 1, weight: 700 }) * face.width;
  return glyphs + Math.max(0, value.length - 1) * tracking;
}

type Line = { text: string; face: Face; size: number; tracking: number; width: number; cap: number };

/**
 * Sets one line at `size`, shrinking it — tracking and all, so the letterfit never
 * distorts — until it fits `maxWidth`.
 */
function line(text: string, face: Face, size: number, tracking: number, maxWidth: number): Line {
  const unit = unitWidth(text, face, tracking);
  const fitted = unit > 0 ? Math.min(size, maxWidth / unit) : size;
  return { text, face, size: fitted, tracking: tracking * fitted, width: unit * fitted, cap: fitted * face.cap };
}

type DrawOptions = {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  fill?: string;
  /** Painted under the fill to thicken a face the machine may only have in book weight. */
  stroke?: number;
};

function draw({ text, face, size, tracking }: Line, { x, y, anchor = "middle", weight = 700, fill = "#000", stroke = 0 }: DrawOptions) {
  // A tracked run carries one trailing gap; nudging by half of it re-centres the word.
  const offset = anchor === "middle" ? tracking / 2 : anchor === "end" ? tracking : 0;
  const thicken = stroke > 0 ? ` stroke="${fill}" stroke-width="${round(stroke)}" stroke-linejoin="round" paint-order="stroke"` : "";
  return `<text x="${round(x + offset)}" y="${round(y)}" text-anchor="${anchor}" font-family="${face.family}" font-size="${round(size)}" font-weight="${weight}" letter-spacing="${round(tracking)}" fill="${fill}"${thicken}>${escapeXml(text)}</text>`;
}

const rule = (y: number, x: number, span: number, weight: number, dash = "") =>
  `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x + span)}" y2="${round(y)}" stroke="#000" stroke-width="${weight}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

/**
 * Two identical arches would collide on one id, but they are also the same
 * geometry — so a content hash is both unique enough and harmless when it is not.
 */
function markId(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pp-arc-${(hash >>> 0).toString(36)}`;
}

const owner = (firstName: string) => possessive(firstName.trim() || "Pete").toUpperCase();
const ownerPrinter = (firstName: string) => `${owner(firstName)} PRINTER`;

export const wordmarkStyles: WordmarkStyle[] = [
  {
    id: "owners-printer-western",
    name: "Arch",
    description: "Your name curved over the word printer, like a shopfront.",
    suggest: (firstName) => ({ primary: owner(firstName), secondary: "PRINTER" }),
  },
  {
    id: "kitchen-dispatch",
    name: "Bar",
    description: "Knocked out of solid ink. Reads across a room.",
    suggest: (firstName) => ({ primary: ownerPrinter(firstName), secondary: "" }),
  },
  {
    id: "masthead-press",
    name: "Masthead",
    description: "Newspaper rules above and below a serif line.",
    suggest: (firstName) => ({ primary: ownerPrinter(firstName), secondary: "" }),
  },
  {
    id: "mono-ticket",
    name: "Ticket",
    description: "Typewriter caps between two perforations.",
    suggest: (firstName) => ({ primary: ownerPrinter(firstName), secondary: "" }),
  },
  {
    id: "oval-badge",
    name: "Badge",
    description: "A maker's oval, stamped on the back of a thing.",
    suggest: (firstName) => ({ primary: owner(firstName), secondary: "PRINTER" }),
  },
  {
    id: "block-modern",
    name: "Block",
    description: "Heavy caps on a rule. Loud and current.",
    suggest: (firstName) => ({ primary: ownerPrinter(firstName), secondary: "" }),
  },
];

const stylesById = new Map(wordmarkStyles.map((style) => [style.id, style]));

export const wordmarkStyleIds = wordmarkStyles.map((style) => style.id);
export const defaultWordmarkStyleId: WordmarkStyleId = "owners-printer-western";

export function getWordmarkStyle(id: string): WordmarkStyle {
  return stylesById.get(id as WordmarkStyleId) ?? wordmarkStyles[0];
}

export function isWordmarkStyleId(value: string): value is WordmarkStyleId {
  return stylesById.has(value as WordmarkStyleId);
}

export function isWordmarkSize(value: string): value is WordmarkSize {
  return (wordmarkSizeIds as readonly string[]).includes(value);
}

export function suggestWordmark(id: string, firstName: string): { primary: string; secondary: string } {
  return getWordmarkStyle(id).suggest(firstName);
}

/** The one line a mark says, for places that show it as UI text rather than paper. */
export function wordmarkLabel(id: string, firstName: string) {
  const { primary, secondary } = suggestWordmark(id, firstName);
  const spoken = secondary ? `${primary} ${secondary}` : primary;
  return spoken.replace(/\s+/g, " ").trim();
}

/**
 * Switching marks — or changing the name behind them — re-suggests only the lines
 * the person never touched. Their own words survive; a line they emptied stays empty.
 */
export function restyleLogo(data: LogoData, style: WordmarkStyleId, firstName: string, previousFirstName = firstName): LogoData {
  const previous = suggestWordmark(data.style, previousFirstName);
  const next = suggestWordmark(style, firstName);
  const untouched = (data.secondary ?? "").trim() === previous.secondary;
  return {
    ...data,
    style,
    primary: data.primary.trim() === previous.primary ? next.primary : data.primary,
    secondary: (untouched ? next.secondary : data.secondary) || undefined,
  };
}

export function createLogoData(style: WordmarkStyleId, firstName: string): LogoData {
  const suggestion = suggestWordmark(style, firstName);
  return { style, primary: suggestion.primary, secondary: suggestion.secondary || undefined, size: defaultWordmarkSize };
}

/** The subordinate line under a mark: small, widely tracked, never larger than it earns. */
function underline(text: string, face: Face, size: number, maxWidth: number) {
  return line(text, face, Math.max(10, size), 0.17, maxWidth);
}

function renderArch(data: LogoData, width: number): Part {
  const inset = width * 0.02;
  const span = width - inset * 2;
  // A fixed rise, so every name gets the same silhouette and only the type size moves.
  // An eighth of the chord swings the outer letters round about twenty-eight degrees.
  const rise = span * 0.128;
  const radius = (span * span / 4 + rise * rise) / (2 * rise);
  const arc = 2 * radius * Math.asin(span / 2 / radius);

  const tracking = -0.008;
  const unit = unitWidth(data.primary, SIGN, tracking);
  // The name sets edge to edge on the arc. Nothing else makes an arch read as one.
  const size = Math.min(width * 0.34, unit > 0 ? arc / unit : width * 0.34);
  const arched = { text: data.primary, face: SIGN, size, tracking: tracking * size, width: unit * size, cap: size * SIGN.cap };

  const endBaseline = rise + arched.cap;
  const crownBaseline = endBaseline - rise;
  const id = markId(`${data.primary}:${round(width)}`);

  let markup = `<defs><path id="${id}" d="M ${round(inset)} ${round(endBaseline)} A ${round(radius)} ${round(radius)} 0 0 1 ${round(width - inset)} ${round(endBaseline)}" fill="none"/></defs>`;
  markup += `<text text-anchor="middle" font-family="${SIGN.family}" font-size="${round(size)}" letter-spacing="${round(arched.tracking)}" fill="#000"><textPath href="#${id}" startOffset="50%">${escapeXml(data.primary)}</textPath></text>`;

  let height = endBaseline;
  if (data.secondary) {
    // The word beneath tucks into the crown rather than clearing the whole arch, which
    // is what closes the gap. How far it can rise is set by the curve above its own ends.
    const under = line(data.secondary, SERIF, arched.cap * 0.33 / SERIF.cap, 0.16, arched.width * 0.66);
    const reach = Math.min(under.width / 2, span / 2) / radius;
    const clearance = radius * (1 - Math.cos(reach)) + under.cap * 0.42;
    const baseline = crownBaseline + clearance + under.cap;
    markup += draw(under, { x: width / 2, y: baseline, stroke: under.size * 0.02 });
    height = Math.max(height, baseline);
  }
  return { markup, height: Math.ceil(height) };
}

function renderBar(data: LogoData, width: number): Part {
  const padX = width * 0.05;
  const set = line(data.primary, CONDENSED, width * 0.125, 0.05, width - padX * 2);
  const padY = set.cap * 0.42;
  const barHeight = Math.round(set.cap + padY * 2);

  let markup = `<rect x="0" y="0" width="${round(width)}" height="${barHeight}" fill="#000"/>`;
  markup += draw(set, { x: width / 2, y: padY + set.cap, weight: 800, fill: "#fff" });

  let height = barHeight;
  if (data.secondary) {
    const under = underline(data.secondary, SANS, width * 0.03, width * 0.8);
    const baseline = barHeight + under.cap * 0.95 + under.cap;
    markup += draw(under, { x: width / 2, y: baseline });
    height = baseline;
  }
  return { markup, height: Math.ceil(height) };
}

function renderMasthead(data: LogoData, width: number): Part {
  const set = line(data.primary, SERIF, width * 0.135, 0.015, width * 0.98);
  const heavyRule = Math.max(3, Math.round(set.cap * 0.075));
  const hairline = 1.25;

  let markup = `<rect x="0" y="0" width="${round(width)}" height="${heavyRule}" fill="#000"/>`;
  const upper = heavyRule + 3.5;
  markup += rule(upper, 0, width, hairline);

  const baseline = upper + set.cap * 0.36 + set.cap;
  markup += draw(set, { x: width / 2, y: baseline, stroke: set.size * 0.016 });

  let height = baseline + set.cap * 0.38;
  markup += rule(height, 0, width, hairline);
  if (data.secondary) {
    const under = underline(data.secondary, SERIF, width * 0.028, width * 0.8);
    const secondaryBaseline = height + under.cap * 1.05 + under.cap;
    markup += draw(under, { x: width / 2, y: secondaryBaseline });
    height = secondaryBaseline;
  }
  return { markup, height: Math.ceil(height + hairline / 2) };
}

function renderTicket(data: LogoData, width: number): Part {
  const set = line(data.primary, MONO, width * 0.115, 0.09, width * 0.96);
  const gap = set.cap * 0.55;
  const perforation = "5 5";

  let markup = rule(0.75, 0, width, 1.5, perforation);
  const baseline = 1.5 + gap + set.cap;
  markup += draw(set, { x: width / 2, y: baseline, stroke: set.size * 0.028 });

  let height = baseline + gap;
  if (data.secondary) {
    const under = underline(data.secondary, MONO, width * 0.026, width * 0.7);
    const secondaryBaseline = baseline + set.cap * 0.75 + under.cap;
    markup += draw(under, { x: width / 2, y: secondaryBaseline });
    height = secondaryBaseline + gap;
  }
  markup += rule(height, 0, width, 1.5, perforation);
  return { markup, height: Math.ceil(height + 0.75) };
}

function renderBadge(data: LogoData, width: number): Part {
  const stroke = 3;
  const rx = width / 2 - stroke;
  const dotRadius = () => Math.max(1.6, width * 0.005);

  const build = (primarySize: number) => {
    const primary = line(data.primary, SERIF, primarySize, 0.02, width * 0.72);
    const secondary = data.secondary ? underline(data.secondary, SANS, primary.size * 0.3, width * 0.5) : undefined;
    const dividerSpan = secondary ? width * 0.11 : 0;
    const gap = primary.cap * 0.42;
    const content = primary.cap + (secondary ? gap * 2 + secondary.cap : 0);
    // Enough room above and below the words that the oval never crowds them.
    const ry = content / 2 + primary.cap * 0.72;
    return { primary, secondary, dividerSpan, gap, content, ry };
  };

  let badge = build(width * 0.15);
  // The oval narrows towards its ends, so a line is fitted to the ellipse at its own
  // height rather than to the paper — otherwise a long name runs into the curve.
  const innerWidth = (offset: number) => 2 * rx * Math.sqrt(Math.max(0.04, 1 - (offset / badge.ry) ** 2)) - width * 0.1;
  const primaryTop = badge.content / 2;
  if (badge.primary.width > innerWidth(primaryTop)) {
    badge = build(badge.primary.size * (innerWidth(primaryTop) / badge.primary.width));
  }

  const { primary, secondary, dividerSpan, gap, content, ry } = badge;
  const height = Math.ceil(ry * 2 + stroke * 2);
  const centre = { x: width / 2, y: height / 2 };
  const top = centre.y - content / 2;

  let markup = `<ellipse cx="${round(centre.x)}" cy="${round(centre.y)}" rx="${round(rx)}" ry="${round(ry)}" fill="none" stroke="#000" stroke-width="${stroke}"/>`;
  markup += draw(primary, { x: centre.x, y: top + primary.cap, stroke: primary.size * 0.018 });
  if (secondary) {
    const dividerY = top + primary.cap + gap;
    markup += rule(dividerY, centre.x - dividerSpan / 2, dividerSpan, 1.4);
    const dot = dotRadius();
    markup += `<circle cx="${round(centre.x - dividerSpan / 2 - dot * 2.4)}" cy="${round(dividerY)}" r="${round(dot)}" fill="#000"/>`;
    markup += `<circle cx="${round(centre.x + dividerSpan / 2 + dot * 2.4)}" cy="${round(dividerY)}" r="${round(dot)}" fill="#000"/>`;
    markup += draw(secondary, { x: centre.x, y: dividerY + gap + secondary.cap });
  }
  return { markup, height };
}

function renderBlock(data: LogoData, width: number): Part {
  const set = line(data.primary, HEAVY, width * 0.128, -0.02, width);
  const barHeight = Math.max(3, Math.round(set.cap * 0.15));
  const barY = set.cap + set.cap * 0.26;

  let markup = draw(set, { x: 0, y: set.cap, anchor: "start", weight: 900 });
  markup += `<rect x="0" y="${round(barY)}" width="${round(width)}" height="${barHeight}" fill="#000"/>`;

  let height = barY + barHeight;
  if (data.secondary) {
    const under = underline(data.secondary, SANS, width * 0.03, width * 0.8);
    const baseline = height + under.cap * 0.95 + under.cap;
    markup += draw(under, { x: 0, y: baseline, anchor: "start" });
    height = baseline;
  }
  return { markup, height: Math.ceil(height) };
}

const renderers: Record<WordmarkStyleId, (data: LogoData, width: number) => Part> = {
  "owners-printer-western": renderArch,
  "kitchen-dispatch": renderBar,
  "masthead-press": renderMasthead,
  "mono-ticket": renderTicket,
  "oval-badge": renderBadge,
  "block-modern": renderBlock,
};

/**
 * How much of the paper's width a size claims. Large reproduces the original,
 * uninset size; the rest scale the width fed to the per-style renderer, which
 * is what keeps every style's internal proportions — the Arch's arc, the
 * Badge's oval — intact rather than distorting glyphs in place.
 */
const wordmarkSizeScale: Record<WordmarkSize, number> = { small: 0.5, medium: 0.72, large: 1 };

/**
 * Marks are set in caps, always, whatever anyone types.
 *
 * Not a stylistic preference. The sign face is a subset cut to capitals, digits and
 * punctuation, so a lowercase letter has no glyph and silently falls back to Georgia
 * — which puts two unrelated faces inside one word. Every face's metrics here are
 * cap-height calibrated too, so mixed case also mis-measures every gap and rule.
 * Uppercasing at the one point every style passes through is what makes that
 * impossible to get wrong from a form, a template, or an agent.
 */
const markText = (value: string) => value.toUpperCase();

export function renderLogo(data: LogoData, width: number): Part {
  const style = isWordmarkStyleId(data.style) ? data.style : defaultWordmarkStyleId;
  const primary = markText(data.primary.trim() || suggestWordmark(style, "").primary);
  const secondary = data.secondary?.trim() ? markText(data.secondary.trim()) : undefined;
  const size = data.size && data.size in wordmarkSizeScale ? data.size : defaultWordmarkSize;
  const scale = wordmarkSizeScale[size];
  const scaledWidth = width * scale;
  // The renderers take the already-scaled width and never read `size` themselves, but it
  // travels with the data so a style can consult it later without changing this call.
  const part = renderers[style]({ style, primary, secondary, size }, scaledWidth);
  if (scale === 1) return part;
  // The renderer only ever knows its own, narrower canvas; centring it in the
  // full width here is what keeps every style's own logic width-agnostic.
  const offset = round((width - scaledWidth) / 2);
  return { markup: `<g transform="translate(${offset} 0)">${part.markup}</g>`, height: part.height };
}
