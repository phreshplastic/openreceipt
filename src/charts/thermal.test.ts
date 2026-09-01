import { describe, expect, it } from "vitest";
import { renderThermalChart, type ThermalChartSpec } from "./thermal";

describe("thermal chart renderer", () => {
  const specs: ThermalChartSpec[] = [
    { kind: "line", width: 320, height: 100, values: [3, 5, 4, 8, 6], fill: "hatch" },
    { kind: "bars", width: 320, height: 100, values: [2, 5, -1, 8] },
    { kind: "range", width: 320, height: 100, values: [{ low: 2, high: 9, value: 6 }, { low: 4, high: 12, value: 8 }] },
    { kind: "dots", width: 320, height: 100, columns: 7, values: [0, 1, 2, 2, 1, 0, 2, 1, 2, 0, 0, 2, 2, 1] },
    { kind: "timeline", width: 320, height: 100, values: [{ position: 0, state: "past" }, { position: 0.55, state: "current" }, { position: 1, state: "future" }] },
  ];

  it.each(specs)("renders $kind deterministically in monochrome", (spec) => {
    const first = renderThermalChart(spec);
    expect(first).toEqual(renderThermalChart(spec));
    expect(first.markup).not.toMatch(/NaN|undefined|opacity|rgb\(/i);
    expect([...first.markup.matchAll(/#[a-f\d]{3,6}/gi)].map((match) => match[0]).every((color) => ["#000", "#fff"].includes(color.toLowerCase()))).toBe(true);
  });

  it("rejects invalid or empty chart data", () => {
    expect(() => renderThermalChart({ kind: "line", width: 100, height: 50, values: [1] })).toThrow();
    expect(() => renderThermalChart({ kind: "bars", width: 0, height: 50, values: [1] })).toThrow();
    expect(() => renderThermalChart({ kind: "dots", width: 100, height: 50, columns: 0, values: [1] })).toThrow();
  });
});
