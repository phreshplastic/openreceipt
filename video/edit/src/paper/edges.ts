import { jitterSigned } from "../theme";

export type EdgeKind = "cut" | "torn";

export type SheetEdges = {
  top?: EdgeKind;
  right?: EdgeKind;
  bottom?: EdgeKind;
  left?: EdgeKind;
};

/**
 * A torn edge is fibrous at two scales: a slow wander across the whole edge and a
 * fine per-step ragged bite. Every edge torn looks like a filter, so callers mix
 * torn and cut deliberately.
 */
const tornPoints = (length: number, seed: number, amplitude: number) => {
  const step = 7;
  const count = Math.max(2, Math.round(length / step));
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count;
    const wander = Math.sin(t * Math.PI * 2.3 + seed) * amplitude * 0.55;
    const bite = jitterSigned(seed * 97 + index * 13.7) * amplitude;
    const fine = jitterSigned(seed * 31 + index * 4.1) * amplitude * 0.35;
    return { t, offset: wander + bite + fine };
  });
};

/**
 * Outline of a sheet in its own pixel space, for `clip-path: path()`.
 * Torn edges bite inwards; cut edges are dead straight.
 */
export const sheetPath = ({
  width,
  height,
  edges = {},
  seed = 1,
  amplitude = 3.2,
}: {
  width: number;
  height: number;
  edges?: SheetEdges;
  seed?: number;
  amplitude?: number;
}) => {
  const parts: string[] = [];
  const push = (x: number, y: number) =>
    parts.push(`${parts.length === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);

  const run = (kind: EdgeKind | undefined, length: number, seedOffset: number, at: (t: number, offset: number) => [number, number]) => {
    if (kind !== "torn") {
      const [x, y] = at(1, 0);
      push(x, y);
      return;
    }
    for (const point of tornPoints(length, seed + seedOffset, amplitude)) {
      const [x, y] = at(point.t, point.offset);
      push(x, y);
    }
  };

  push(0, 0);
  run(edges.top, width, 0.7, (t, o) => [t * width, o]);
  run(edges.right, height, 2.3, (t, o) => [width + o, t * height]);
  run(edges.bottom, width, 4.1, (t, o) => [width - t * width, height + o]);
  run(edges.left, height, 6.5, (t, o) => [o, height - t * height]);

  return `${parts.join(" ")} Z`;
};

/**
 * Thermal receipt outline. The roll is slit, so the sides are dead straight and
 * the top is a clean cut; only the tear-off bottom is serrated.
 *
 * Geometry follows the product's own editor edge (`src/components/PaperSurface.tsx`:
 * 40 teeth across the width, 4px deep at ~450px preview width), with a little
 * per-tooth jitter so a standalone strip does not read as vector art.
 */
export const APP_TOOTH_COUNT = 40;

/**
 * The editor's own edge: 40 teeth, 4px deep at ~450px preview width. Use this when
 * a shot has to agree with on-screen UI.
 */
export const APP_TOOTH_DEPTH_RATIO = 4 / 450;

/**
 * A real 80mm tear-off is deeper than the editor draws it — roughly 1.5mm of bite
 * on 80mm of width. Use this for a strip standing alone in the film, where the
 * edge is the whole reason the viewer believes the stock.
 */
export const REAL_TOOTH_DEPTH_RATIO = 1.5 / 80;

export const stripPath = ({
  width,
  height,
  seed = 1,
  teeth = APP_TOOTH_COUNT,
  serrateTop = false,
  depthRatio = REAL_TOOTH_DEPTH_RATIO,
}: {
  width: number;
  height: number;
  seed?: number;
  teeth?: number;
  serrateTop?: boolean;
  depthRatio?: number;
}) => {
  const depth = width * depthRatio;
  const pitch = width / teeth;

  const serration = (y: number, direction: 1 | -1, seedOffset: number) => {
    const points: string[] = [];
    for (let index = 0; index <= teeth * 2; index += 1) {
      const x = direction === 1 ? (index * pitch) / 2 : width - (index * pitch) / 2;
      const wobble = 1 + jitterSigned(seed * 53 + index * 7.3 + seedOffset) * 0.08;
      const peak = index % 2 === 0 ? 0 : depth * wobble;
      points.push(`L${x.toFixed(2)} ${(y + peak * direction * -1).toFixed(2)}`);
    }
    return points.join(" ");
  };

  const top = serrateTop
    ? `M0 ${depth.toFixed(2)} ${serration(depth, 1, 11)}`
    : `M0 0 L${width.toFixed(2)} 0`;

  return `${top} L${width.toFixed(2)} ${(height - depth).toFixed(2)} ${serration(height - depth, -1, 0)} Z`;
};
