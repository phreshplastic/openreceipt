import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const origin = (process.env.PETES_PRINTER_PUBLIC_URL || "").replace(/\/$/, "");
if (!origin) throw new Error("PETES_PRINTER_PUBLIC_URL is required for verification.");

const site = JSON.parse(await readFile(join(root, "content/site.json"), "utf8"));
const read = (path) => readFile(join(dist, path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const home = await read("index.html");
assert(home.includes(`<title>${site.meta.title}</title>`), "Landing title is missing.");
assert(home.includes(site.hero.heading), "Landing H1 is not pre-rendered.");
assert(home.includes(`rel="canonical" href="${origin}/"`), "Landing canonical is missing.");
assert(home.includes('type="application/ld+json"'), "Landing JSON-LD is missing.");
assert(home.includes('rel="alternate" type="text/markdown"'), "Landing Markdown alternate is missing.");

const routes = ["/", "/guides", ...site.guides.map((guide) => `/guides/${guide.slug}`)];
const htmlFiles = ["index.html", "guides/index.html", ...site.guides.map((guide) => `guides/${guide.slug}/index.html`)];
const seenTitles = new Set();
const seenDescriptions = new Set();
const seenCanonicals = new Set();
for (const path of htmlFiles) {
  const html = await read(path);
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  const description = html.match(/<meta name="description" content="(.*?)"\s*\/>/s)?.[1];
  const canonical = html.match(/<link rel="canonical" href="(.*?)"\s*\/>/s)?.[1];
  assert(title && !seenTitles.has(title), `${path} needs a unique title.`);
  assert(description && !seenDescriptions.has(description), `${path} needs a unique description.`);
  assert(canonical && !seenCanonicals.has(canonical), `${path} needs a unique canonical URL.`);
  assert(html.includes('rel="alternate" type="text/markdown"'), `${path} needs a Markdown alternate.`);
  for (const schema of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) JSON.parse(schema[1]);
  seenTitles.add(title);
  seenDescriptions.add(description);
  seenCanonicals.add(canonical);
}
const sitemap = await read("sitemap.xml");
for (const route of routes) assert(sitemap.includes(`<loc>${origin}${route === "/" ? "/" : route}</loc>`), `Sitemap is missing ${route}.`);
assert((sitemap.match(/<url>/g) || []).length === routes.length, "Sitemap includes an unexpected route.");

for (const guide of site.guides) {
  const html = await read(join("guides", guide.slug, "index.html"));
  const markdown = await read(join("guides", `${guide.slug}.md`));
  assert(html.includes(`<h1>${guide.title}</h1>`), `${guide.slug} is not pre-rendered.`);
  assert(!html.includes('<script type="module"'), `${guide.slug} should not require JavaScript.`);
  assert(html.includes(`${origin}/guides/${guide.slug}`), `${guide.slug} canonical is missing.`);
  assert(markdown.includes(`canonical_url: ${origin}/guides/${guide.slug}`), `${guide.slug} Markdown canonical is missing.`);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  assert(schemas.length === 1, `${guide.slug} needs one JSON-LD graph.`);
  JSON.parse(schemas[0][1]);
}

for (const path of ["llms.txt", "sitemap.md", "index.md", "AGENTS.md", "robots.txt", "404.html", "favicon.png", "apple-touch-icon.png", "openreceipt-mark.png"]) await stat(join(dist, path));
assert(home.includes('rel="icon" type="image/png" href="/favicon.png"'), "Landing favicon is missing.");
assert(home.includes('src="/openreceipt-mark.png"'), "Landing wordmark mark is missing.");
const robots = await read("robots.txt");
for (const bot of ["Googlebot", "Bingbot", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot"]) assert(robots.includes(`User-agent: ${bot}\nAllow: /`), `${bot} retrieval policy is missing.`);
for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"]) assert(robots.includes(`User-agent: ${bot}\nDisallow: /`), `${bot} training policy is missing.`);
for (const path of ["app/index.html", "setup/index.html", "blocks/index.html", "blocks/charts/index.html"]) {
  assert((await read(path)).includes('name="robots" content="noindex,nofollow"'), `${path} needs noindex.`);
}

const manifest = JSON.parse(await read(".vite/manifest.json"));
const entries = Object.values(manifest);
const main = entries.find((entry) => entry.isEntry);
assert(main, "The public Vite entry is missing from the manifest.");
const selected = new Set();
const addStatic = (entry) => {
  if (!entry || selected.has(entry.file)) return;
  selected.add(entry.file);
  for (const imported of entry.imports || []) addStatic(manifest[imported]);
};
addStatic(main);
let gzipBytes = 0;
for (const file of selected) {
  if (!file.endsWith(".js")) continue;
  const source = await readFile(join(dist, file));
  const javascript = source.toString("utf8");
  for (const privateMarker of ["/api/v1/session", "document.modelContext", "ReceiptEditor"]) assert(!javascript.includes(privateMarker), `Public JavaScript contains private application code (${privateMarker}).`);
  gzipBytes += gzipSync(source).byteLength;
}
// The landing renders real receipts with the app's own renderer, so the schema and block
// painters are load-bearing rather than decoration. Everything optional — the WebGL
// gradient, the editor, the guides, the WebMCP tools — is behind a dynamic import.
const budgetKb = 160;
assert(gzipBytes <= budgetKb * 1024, `Initial public JavaScript is ${(gzipBytes / 1024).toFixed(1)} kB gzip; budget is ${budgetKb} kB.`);

process.stdout.write(`Public build verified: ${routes.length} HTML routes, ${site.guides.length} Markdown guides, ${(gzipBytes / 1024).toFixed(1)} kB initial JavaScript gzip.\n`);
