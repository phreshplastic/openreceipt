import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startThermalChartMotion, stopThermalChartMotion } from "./motion";

function chartPath(d: string, blockId?: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  if (blockId) svg.setAttribute("data-block-id", blockId);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("data-chart-series", "line");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

async function attached(svg: SVGSVGElement) {
  document.body.append(svg);
  await Promise.resolve();
}

describe("thermal chart motion", () => {
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    animate = vi.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
    Object.defineProperty(Element.prototype, "animate", { configurable: true, writable: true, value: animate });
    startThermalChartMotion();
  });

  afterEach(() => {
    stopThermalChartMotion();
    document.body.replaceChildren();
    Reflect.deleteProperty(Element.prototype, "animate");
    vi.restoreAllMocks();
  });

  it("draws a new line once, then leaves a replacement of the same shape still", async () => {
    const first = chartPath("M0 0 L10 10", "weather");
    await attached(first);
    expect(animate).toHaveBeenCalledTimes(1);
    await Promise.resolve();

    first.remove();
    await attached(chartPath("M0 0 L10 10", "weather"));
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("draws again when the line itself changes", async () => {
    const first = chartPath("M0 0 L10 10", "weather");
    await attached(first);
    first.remove();

    await attached(chartPath("M0 0 L4 8 L12 3", "weather"));
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("does not draw when the person prefers reduced motion", async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false; },
    }) as unknown as typeof window.matchMedia;
    await attached(chartPath("M0 0 L10 10"));
    expect(animate).not.toHaveBeenCalled();
  });
});
