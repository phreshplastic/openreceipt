import { jitterSigned } from "../theme";

export type MotifKind = "circle" | "triangle" | "square" | "pill" | "arc" | "strip";

/**
 * The box a shape actually occupies, given its nominal `size` (its width).
 *
 * Not every outline fills a square. A strip is a sixth as tall as it is wide,
 * and drawing it inside a square box would leave the visible shape pinned to
 * the top — so anything positioning by centre would sit it far above where it
 * was asked to go, and overlap whatever is above it.
 */
export function motifBox(kind: MotifKind, size: number): { width: number; height: number } {
  switch (kind) {
    case "triangle":
      return { width: size, height: size * 0.88 };
    case "pill":
      return { width: size, height: size * 0.42 };
    case "strip":
      return { width: size, height: size * 0.16 };
    default:
      return { width: size, height: size };
  }
}

/**
 * Outlines for shapes that look cut from paper by hand.
 *
 * The wobble is the whole point. A mathematically perfect circle reads as a
 * vector graphic no matter how much texture is layered on it; an outline that
 * drifts a couple of pixels off true reads as scissors. Every offset comes from
 * `jitterSigned`, so the same seed always cuts the same shape and the geometry
 * does not crawl between rendered frames.
 */
export function motifPath(kind: MotifKind, size: number, seed = 1, wobble = 0.014): string {
  switch (kind) {
    case "circle":
      return ring(size / 2, size / 2, size / 2, 72, seed, size * wobble);
    case "triangle":
      return polygon(
        [
          [size / 2, 0],
          [size, size * 0.88],
          [0, size * 0.88],
        ],
        seed,
        size * wobble,
      );
    case "square":
      return polygon(
        [
          [0, 0],
          [size, 0],
          [size, size],
          [0, size],
        ],
        seed,
        size * wobble,
      );
    case "pill":
      return roundedStrip(size, size * 0.42, seed, size * wobble);
    case "strip":
      return roundedStrip(size, size * 0.16, seed, size * wobble * 1.4);
    case "arc":
      return arc(size, seed, size * wobble);
  }
}

/** A closed ring of points whose radius drifts, like a circle cut freehand. */
function ring(cx: number, cy: number, r: number, steps: number, seed: number, amp: number): string {
  const points: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const drift =
      jitterSigned(seed * 17.3 + i * 3.1) * amp + Math.sin(angle * 2.7 + seed) * amp * 0.5;
    const radius = r + drift;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(2)} ${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `M${points.join(" L")} Z`;
}

/** Straight edges, subdivided and nudged along their normal so no line is dead true. */
function polygon(corners: readonly (readonly [number, number])[], seed: number, amp: number): string {
  const points: string[] = [];
  for (let c = 0; c < corners.length; c += 1) {
    const [x1, y1] = corners[c];
    const [x2, y2] = corners[(c + 1) % corners.length];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(3, Math.round(length / 16));
    const nx = -dy / length;
    const ny = dx / length;
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      const push = jitterSigned(seed * 11.7 + c * 5.3 + i * 2.9) * amp;
      points.push(`${(x1 + dx * t + nx * push).toFixed(2)} ${(y1 + dy * t + ny * push).toFixed(2)}`);
    }
  }
  return `M${points.join(" L")} Z`;
}

function roundedStrip(width: number, height: number, seed: number, amp: number): string {
  const r = height / 2;
  const points: string[] = [];
  const cap = (cx: number, from: number, to: number) => {
    const steps = 22;
    for (let i = 0; i <= steps; i += 1) {
      const angle = from + ((to - from) * i) / steps;
      const drift = jitterSigned(seed * 7.9 + i * 4.3 + cx) * amp;
      points.push(`${(cx + Math.cos(angle) * (r + drift)).toFixed(2)} ${(r + Math.sin(angle) * (r + drift)).toFixed(2)}`);
    }
  };
  cap(width - r, -Math.PI / 2, Math.PI / 2);
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    const x = width - r - (width - r * 2) * t;
    points.push(`${x.toFixed(2)} ${(height + jitterSigned(seed * 3.3 + i) * amp).toFixed(2)}`);
  }
  cap(r, Math.PI / 2, (Math.PI * 3) / 2);
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    const x = r + (width - r * 2) * t;
    points.push(`${x.toFixed(2)} ${(jitterSigned(seed * 5.1 + i) * amp).toFixed(2)}`);
  }
  return `M${points.join(" L")} Z`;
}

/** A crescent: a ring with a second ring bitten out of it, wound the other way. */
function arc(size: number, seed: number, amp: number): string {
  const outer = ring(size / 2, size / 2, size / 2, 72, seed, amp);
  const innerPoints: string[] = [];
  const r = size * 0.31;
  for (let i = 72; i > 0; i -= 1) {
    const angle = (i / 72) * Math.PI * 2;
    const drift = jitterSigned(seed * 23.1 + i * 2.7) * amp;
    innerPoints.push(
      `${(size / 2 + Math.cos(angle) * (r + drift)).toFixed(2)} ${(size / 2 + Math.sin(angle) * (r + drift)).toFixed(2)}`,
    );
  }
  return `${outer} M${innerPoints.join(" L")} Z`;
}
