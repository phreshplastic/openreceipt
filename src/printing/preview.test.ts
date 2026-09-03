import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultDocument } from "../receipt";
import { playDemoPrint, receiptPreviewFilename, receiptPreviewHtml } from "./preview";

describe("receiptPreviewFilename", () => {
  it("slugs a title into an svg filename", () => {
    expect(receiptPreviewFilename("LISBON THURSDAY")).toBe("lisbon-thursday.svg");
    expect(receiptPreviewFilename("  Take recycling out  ")).toBe("take-recycling-out.svg");
  });

  it("falls back when the title has no usable characters", () => {
    expect(receiptPreviewFilename("")).toBe("receipt.svg");
    expect(receiptPreviewFilename("***")).toBe("receipt.svg");
  });
});

describe("receiptPreviewHtml", () => {
  it("wraps the svg in a titled html page", () => {
    const html = receiptPreviewHtml("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "Pete's \"slip\"");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Pete&#39;s &quot;slip&quot;</title>");
    expect(html).toContain("<div class=\"slip\"><svg xmlns=\"http://www.w3.org/2000/svg\"></svg></div>");
  });
});

describe("playDemoPrint", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens a tab on the same turn, then holds feeding until complete", async () => {
    vi.useFakeTimers();
    const open = vi.fn(() => ({ opener: null }));
    vi.stubGlobal("open", open);
    const stages: string[] = [];
    const pending = playDemoPrint(createDefaultDocument(), { delayMs: 1800, onStage: (stage) => stages.push(stage) });
    expect(stages).toEqual(["feeding"]);
    expect(open).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1799);
    expect(stages).toEqual(["feeding"]);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(stages).toEqual(["feeding", "complete"]);
  });
});
