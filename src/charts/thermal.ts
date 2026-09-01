import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { area, curveMonotoneX, curveStepAfter, line } from "d3-shape";

type ChartFrame = { width: number; height: number };

export type ThermalChartSpec = ChartFrame & (
  | { kind: "line"; values: number[]; curve?: "smooth" | "step"; fill?: "none" | "hatch"; guides?: number; endDot?: boolean }
  | { kind: "bars"; values: number[]; baseline?: number }
  | { kind: "range"; values: Array<{ low: number; high: number; value: number }> }
  | { kind: "dots"; values: Array<0 | 1 | 2>; columns: number }
  | { kind: "timeline"; values: Array<{ position: number; state: "past" | "current" | "future" }> }
);

export type ThermalChartResult = ChartFrame & { markup: string };

function extent(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min || Math.max(1, Math.abs(max))) * 0.12;
  return [min - padding, max + padding] as const;
}

function stableId(spec: ThermalChartSpec) {
  const source = JSON.stringify(spec);
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `thermal-${(hash >>> 0).toString(36)}`;
}

function renderLine(spec: Extract<ThermalChartSpec, { kind: "line" }>) {
  if (spec.values.length < 2) throw new Error("A thermal line chart needs at least two values.");
  const x = scalePoint<number>().domain(spec.values.map((_, index) => index)).range([2, spec.width - 2]);
  const y = scaleLinear().domain(extent(spec.values)).range([spec.height - 3, 3]);
  const curve = spec.curve === "step" ? curveStepAfter : curveMonotoneX;
  const path = line<number>().x((_, index) => x(index) ?? 0).y((value) => y(value)).curve(curve)(spec.values);
  if (!path) throw new Error("Could not generate a thermal line path.");
  const guideCount = spec.guides ?? 3;
  const guides = Array.from({ length: guideCount }, (_, index) => {
    const guideY = Math.round((index + 1) * spec.height / (guideCount + 1)) + 0.5;
    return `<line x1="0" y1="${guideY}" x2="${spec.width}" y2="${guideY}" stroke="#000" stroke-width="1" stroke-dasharray="2 6"/>`;
  }).join("");
  let fill = "";
  if (spec.fill === "hatch") {
    const areaPath = area<number>().x((_, index) => x(index) ?? 0).y0(spec.height).y1((value) => y(value)).curve(curve)(spec.values);
    const clipId = `${stableId(spec)}-clip`;
    const hatch = Array.from({ length: Math.ceil((spec.width + spec.height) / 9) + 1 }, (_, index) => {
      const offset = index * 9 - spec.height;
      return `<line x1="${offset}" y1="${spec.height}" x2="${offset + spec.height}" y2="0" stroke="#000" stroke-width="1"/>`;
    }).join("");
    fill = `<defs><clipPath id="${clipId}"><path d="${areaPath}"/></clipPath></defs><g clip-path="url(#${clipId})">${hatch}</g>`;
  }
  const lastX = x(spec.values.length - 1) ?? spec.width;
  const lastY = y(spec.values.at(-1)!);
  const endDot = spec.endDot === false ? "" : `<circle cx="${lastX}" cy="${lastY}" r="4" fill="#fff" stroke="#000" stroke-width="3"/>`;
  return `${guides}${fill}<path data-chart-series="line" pathLength="1" d="${path}" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${endDot}`;
}

function renderBars(spec: Extract<ThermalChartSpec, { kind: "bars" }>) {
  if (!spec.values.length) throw new Error("A thermal bar chart needs values.");
  const baseline = spec.baseline ?? 0;
  const [minimum, maximum] = extent([...spec.values, baseline]);
  const x = scaleBand<number>().domain(spec.values.map((_, index) => index)).range([0, spec.width]).paddingInner(0.28).paddingOuter(0.06);
  const y = scaleLinear().domain([minimum, maximum]).range([spec.height - 2, 2]);
  const baselineY = y(baseline);
  const bars = spec.values.map((value, index) => {
    const valueY = y(value);
    const top = Math.min(valueY, baselineY);
    const height = Math.max(2, Math.abs(baselineY - valueY));
    return `<rect x="${x(index)}" y="${top}" width="${x.bandwidth()}" height="${height}" fill="#000"/>`;
  }).join("");
  return `<line x1="0" y1="${baselineY}" x2="${spec.width}" y2="${baselineY}" stroke="#000" stroke-width="1"/>${bars}`;
}

function renderRange(spec: Extract<ThermalChartSpec, { kind: "range" }>) {
  if (!spec.values.length) throw new Error("A thermal range chart needs values.");
  const domain = extent(spec.values.flatMap((value) => [value.low, value.high, value.value]));
  const x = scaleLinear().domain(domain).range([6, spec.width - 6]);
  const rowHeight = spec.height / spec.values.length;
  return spec.values.map((value, index) => {
    const center = rowHeight * index + rowHeight / 2;
    const low = x(value.low);
    const high = x(value.high);
    const current = x(value.value);
    return `<line x1="${low}" y1="${center}" x2="${high}" y2="${center}" stroke="#000" stroke-width="3"/><line x1="${low}" y1="${center - 7}" x2="${low}" y2="${center + 7}" stroke="#000" stroke-width="2"/><line x1="${high}" y1="${center - 7}" x2="${high}" y2="${center + 7}" stroke="#000" stroke-width="2"/><circle cx="${current}" cy="${center}" r="5" fill="#000"/>`;
  }).join("");
}

function renderDots(spec: Extract<ThermalChartSpec, { kind: "dots" }>) {
  if (!spec.values.length || spec.columns < 1) throw new Error("A thermal dot chart needs values and columns.");
  const rows = Math.ceil(spec.values.length / spec.columns);
  const cellWidth = spec.width / spec.columns;
  const cellHeight = spec.height / rows;
  const radius = Math.max(2, Math.min(cellWidth, cellHeight) * 0.26);
  return spec.values.map((value, index) => {
    const x = index % spec.columns * cellWidth + cellWidth / 2;
    const y = Math.floor(index / spec.columns) * cellHeight + cellHeight / 2;
    if (value === 2) return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#000"/>`;
    if (value === 1) return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#fff" stroke="#000" stroke-width="2"/>`;
    return `<circle cx="${x}" cy="${y}" r="${Math.max(1.5, radius * 0.28)}" fill="#000"/>`;
  }).join("");
}

function renderTimeline(spec: Extract<ThermalChartSpec, { kind: "timeline" }>) {
  if (!spec.values.length) throw new Error("A thermal timeline needs events.");
  const x = scaleLinear().domain([0, 1]).range([10, spec.width - 10]);
  const center = spec.height / 2;
  const points = [...spec.values].sort((a, b) => a.position - b.position);
  const completed = points.filter((point) => point.state !== "future").at(-1);
  let markup = `<line x1="10" y1="${center}" x2="${spec.width - 10}" y2="${center}" stroke="#000" stroke-width="2"/>`;
  if (completed) markup += `<line x1="10" y1="${center}" x2="${x(completed.position)}" y2="${center}" stroke="#000" stroke-width="6"/>`;
  return markup + points.map((point) => {
    const position = x(Math.max(0, Math.min(1, point.position)));
    if (point.state === "current") return `<path d="M ${position} ${center - 8} L ${position + 8} ${center} L ${position} ${center + 8} L ${position - 8} ${center} Z" fill="#fff" stroke="#000" stroke-width="3"/>`;
    return `<circle cx="${position}" cy="${center}" r="6" fill="${point.state === "past" ? "#000" : "#fff"}" stroke="#000" stroke-width="2"/>`;
  }).join("");
}

export function renderThermalChart(spec: ThermalChartSpec): ThermalChartResult {
  if (!Number.isFinite(spec.width) || !Number.isFinite(spec.height) || spec.width <= 0 || spec.height <= 0) throw new Error("Thermal chart dimensions must be positive.");
  const markup = spec.kind === "line" ? renderLine(spec)
    : spec.kind === "bars" ? renderBars(spec)
      : spec.kind === "range" ? renderRange(spec)
        : spec.kind === "dots" ? renderDots(spec)
          : renderTimeline(spec);
  return { width: spec.width, height: spec.height, markup };
}
