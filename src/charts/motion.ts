/**
 * Line charts draw themselves once on first paint. A CSS animation on the path
 * cannot do that: selecting a block, opening the inspector, or any other
 * re-render under a filtered paper surface restarts it. Web Animations are tied
 * to the element, and a signature of the line is remembered so a replacement
 * path with the same shape stays still.
 */
const DRAW_MS = 620;
const DRAW_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

const started = new WeakSet<SVGPathElement>();
const drawn = new Set<string>();
const timers = new Set<number>();
let observer: MutationObserver | undefined;

function reducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function signature(path: SVGPathElement) {
  const block = path.closest("[data-block-id]")?.getAttribute("data-block-id") ?? "";
  return `${block}:${path.getAttribute("d") ?? ""}`;
}

function remember(key: string) {
  drawn.add(key);
}

function play(path: SVGPathElement) {
  if (started.has(path)) return;
  started.add(path);
  const key = signature(path);
  if (drawn.has(key)) return;
  if (reducedMotion() || typeof path.animate !== "function") {
    remember(key);
    return;
  }
  const animation = path.animate(
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: DRAW_MS, easing: DRAW_EASE, fill: "both" },
  );
  animation.finished.then(() => remember(key)).catch(() => undefined);
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    remember(key);
  }, DRAW_MS);
  timers.add(timer);
}

function visit(node: Node) {
  if (!(node instanceof Element)) return;
  if (node.matches("path[data-chart-series]")) play(node as SVGPathElement);
  for (const path of node.querySelectorAll("path[data-chart-series]")) play(path as SVGPathElement);
}

export function startThermalChartMotion(root: Node = document.documentElement) {
  stopThermalChartMotion();
  visit(root instanceof Element ? root : document.documentElement);
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) visit(node);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

export function stopThermalChartMotion() {
  observer?.disconnect();
  observer = undefined;
  for (const timer of timers) window.clearTimeout(timer);
  timers.clear();
  drawn.clear();
}
