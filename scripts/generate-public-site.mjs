import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const contentDirectory = join(root, "content");
const publicBuild = process.argv.includes("--public");

if (!publicBuild) throw new Error("generate-public-site.mjs must be called with --public");
const configuredOrigin = process.env.PETES_PRINTER_PUBLIC_URL;
if (!configuredOrigin) throw new Error("PETES_PRINTER_PUBLIC_URL is required for a public build.");
const originUrl = new URL(configuredOrigin);
if (!/^https?:$/.test(originUrl.protocol)) throw new Error("PETES_PRINTER_PUBLIC_URL must use http or https.");
originUrl.pathname = originUrl.pathname.replace(/\/+$/, "");
const origin = originUrl.toString().replace(/\/$/, "");

const site = JSON.parse(await readFile(join(contentDirectory, "site.json"), "utf8"));
const template = await readFile(join(dist, "index.html"), "utf8");
let heroSlipRatio = 1.6;
try {
  const heroSvg = await readFile(join(root, "public/generated/landing-hero.svg"), "utf8");
  const width = Number(/width="(\d+)"/.exec(heroSvg)?.[1]);
  const height = Number(/height="(\d+)"/.exec(heroSvg)?.[1]);
  if (width && height) heroSlipRatio = height / width;
} catch {
  /* generated assets may be missing in a partial run; CSS has a fallback ratio */
}
const guideFiles = (await readdir(join(contentDirectory, "guides"))).filter((name) => name.endsWith(".md"));
const guideRecords = await Promise.all(guideFiles.map(async (name) => {
  const source = await readFile(join(contentDirectory, "guides", name), "utf8");
  const parsed = matter(source);
  const data = parsed.data;
  const required = ["slug", "title", "description", "published", "updated", "summary", "topics"];
  for (const field of required) {
    if (data[field] === undefined || data[field] === "") throw new Error(`${name} is missing frontmatter field ${field}.`);
  }
  if (!Array.isArray(data.topics) || !data.topics.length) throw new Error(`${name} needs at least one topic.`);
  const slug = String(data.slug);
  if (name !== `${slug}.md` || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${name} has an invalid or mismatched slug.`);
  const date = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return {
    ...data,
    slug,
    title: String(data.title),
    description: String(data.description),
    summary: String(data.summary),
    topics: data.topics.map(String),
    published: date(data.published),
    updated: date(data.updated),
    source,
    markdown: parsed.content.trim(),
  };
}));

const bySlug = new Map(guideRecords.map((guide) => [guide.slug, guide]));
const guides = site.guides.map((card) => {
  const guide = bySlug.get(card.slug);
  if (!guide) throw new Error(`site.json references missing guide ${card.slug}.`);
  if (guide.title !== card.title || guide.description !== card.description) throw new Error(`${card.slug} metadata differs between site.json and its guide.`);
  return guide;
});
if (guides.length !== guideRecords.length) throw new Error("Every guide file must be listed in site.json.");

marked.use({ gfm: true });

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const xml = escapeHtml;
const absolute = (pathname) => `${origin}${pathname === "/" ? "/" : pathname}`;
const jsonLd = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

function brandMark(compact = false) {
  const width = compact ? 16 : 20;
  const height = compact ? 22 : 28;
  const copy = compact
    ? `<span class="brand-copy"><strong>${escapeHtml(site.name)}</strong></span>`
    : `<span class="brand-copy"><strong>${escapeHtml(site.name)}</strong><small>Make a little something</small></span>`;
  return `<span class="brand-icon" aria-hidden="true"><img src="/openreceipt-mark.png" alt="" width="${width}" height="${height}" /></span>${copy}`;
}

function brand({ className = "", compact = false } = {}) {
  const classes = ["brand", compact ? "brand-compact" : "", className].filter(Boolean).join(" ");
  return `<a class="${classes}" href="/" aria-label="${escapeHtml(site.name)} home">${brandMark(compact)}</a>`;
}

function footer() {
  return `<footer class="landing-footer public-footer">${brand()}<div><a href="/guides">Thermal printer guides</a><span>Made to be used.</span></div></footer>`;
}

function pageHtml({ title, description, pathname, markdownPath, body, schema, robots = "index,follow", interactive = false }) {
  const canonical = absolute(pathname);
  const ogImage = absolute("/generated/og.png");
  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/>/s, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  if (!interactive) html = html.replace(/\s*<script type="module"[^>]*><\/script>/g, "");
  const metadata = [
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    markdownPath ? `<link rel="alternate" type="text/markdown" href="${escapeHtml(absolute(markdownPath))}" />` : "",
    `<meta property="og:type" content="${pathname.startsWith("/guides/") ? "article" : "website"}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
    schema ? `<script type="application/ld+json">${jsonLd(schema)}</script>` : "",
  ].filter(Boolean).join("\n    ");
  return html.replace("</head>", `    ${metadata}\n  </head>`);
}

function landingBody() {
  const steps = site.steps.map((step, index) => `<div><span class="landing-step-number">${index + 1}</span><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.copy)}</p></div>`).join("");
  const tools = site.tools.map((tool) => `<div class="landing-tool"><code>${escapeHtml(tool.name)}</code><span>${escapeHtml(tool.copy)}</span></div>`).join("");
  const samples = [
    ["Checklists", "landing-checklists.svg"],
    ["Countdowns", "landing-countdowns.svg"],
    ["Habit weeks", "landing-habit-weeks.svg"],
    ["Meeting notes", "landing-meeting-notes.svg"],
  ].map(([name, file]) => `<figure><div class="paper-surface landing-sample-paper"><img src="/generated/${file}" alt="${name} thermal receipt example" /></div><figcaption>${name}</figcaption></figure>`).join("");
  const faqs = site.faqs.map((faq, index) => `<div class="landing-faq-item open"><div class="landing-static-question"><span class="landing-faq-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(faq.question)}</span></div><div class="landing-faq-answer"><div><p>${escapeHtml(faq.answer)}</p></div></div></div>`).join("");
  return `<main class="landing hero-experiment">
    <nav class="landing-nav" aria-label="Site" aria-hidden="true"><div class="landing-nav-inner">${brand({ compact: true, className: "landing-nav-title" })}<a class="button primary small" href="/app" tabindex="-1">${escapeHtml(site.hero.publicCta)}</a></div></nav>
    <section class="hero-experiment-stage" id="moments">${brand({ compact: true, className: "hero-wordmark" })}<div class="moments moments-hero" aria-label="Receipts in the wild"><div class="moments-stage"><div class="moments-slide active" data-side="right" data-align="center"><img class="moments-scene" src="/generated/hero-run.webp" style="object-position:38% 40%" alt="A runner mid-stride across grass, caught with a blur of motion."/><div class="moments-scrim"></div><div class="moments-paper" style="aspect-ratio:628/318"><svg class="moments-paper-edge" viewBox="0 0 628 318" aria-hidden="true"><path d="M0 0H628V309L610 318 592 309 574 318 556 309 538 318 520 309 502 318 484 309 466 318 448 309 430 318 412 309 394 318 376 309 358 318 340 309 322 318 304 309 286 318 268 309 250 318 232 309 214 318 196 309 178 318 160 309 142 318 124 309 106 318 88 309 70 318 52 309 34 318 16 309 0 318Z"/></svg><div class="moments-ink"><img src="/generated/landing-habit-weeks.svg" alt="A printed habit-week receipt"/></div></div></div></div></div><div class="hero-experiment-copy"><h1>${escapeHtml(site.hero.heading)}</h1><p>${escapeHtml(site.hero.copy)}</p><div class="hero-actions"><a class="button primary hero-button" href="/app">${escapeHtml(site.hero.publicCta)} →</a></div></div></section>
    <section class="landing-section" id="how"><h2 class="landing-heading">How it works</h2><div class="landing-steps">${steps}</div></section>
    <section class="landing-section landing-agents"><div class="landing-agents-copy"><h2 class="landing-heading">Built for agents, too.</h2><p>${escapeHtml(site.name)} is a WebMCP app, so a compatible agent sees the same receipt you do. It can draft, edit, and preview — then ask before anything prints.</p></div><div class="landing-tools" aria-label="Agent tools">${tools}</div></section>
    <section class="landing-section" id="blocks"><h2 class="landing-heading">Blocks are the fun part.</h2><p class="landing-subheading">Checklists, countdowns, weather, agendas — small printable pieces, drawn at the printer’s exact dot width.</p><div class="landing-samples">${samples}</div></section>
    <section class="landing-section landing-faq" id="faq"><h2 class="landing-heading">Questions</h2><div class="landing-faq-list">${faqs}</div></section>
    <section class="printer-demo" aria-label="How a receipt reaches the printer"><div class="printer-demo-diagram"><div class="printer-demo-from"><p class="printer-demo-label">Send from</p><div class="printer-demo-inputs"><div class="printer-demo-sources"><button class="printer-demo-source" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><span class="printer-demo-source-copy"><strong>Computer</strong><span>This browser</span></span></button><button class="printer-demo-source" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg><span class="printer-demo-source-copy"><strong>Agent</strong><span>WebMCP</span></span></button><button class="printer-demo-source" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg><span class="printer-demo-source-copy"><strong>Raspberry Pi</strong><span>The local bridge</span></span></button></div><div class="printer-demo-pipe-well"><svg class="printer-demo-pipes printer-demo-pipes-across" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="printer-demo-pipe" d="M0 16.5 C 62 16.5, 62 50, 100 50" /><path class="printer-demo-pipe" d="M0 50 H 100" /><path class="printer-demo-pipe" d="M0 83.5 C 62 83.5, 62 50, 100 50" /></svg></div></div><svg class="printer-demo-pipes printer-demo-pipes-down" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="printer-demo-pipe" d="M16.5 0 C 16.5 62, 50 62, 50 100" /><path class="printer-demo-pipe" d="M50 0 V 100" /><path class="printer-demo-pipe" d="M83.5 0 C 83.5 62, 50 62, 50 100" /></svg></div><div class="printer-demo-stage" style="--slip-ratio:${heroSlipRatio}"><img class="printer-demo-printer" src="/generated/tm-l90.png" alt="Epson TM-L90 thermal printer"/><div class="printer-demo-slot is-idle"><div class="printer-demo-paper"><img src="/generated/landing-hero.svg" alt="Sample printed morning brief"/></div></div><div class="printer-demo-slot-bar" aria-hidden="true"></div><button class="printer-demo-feed" type="button">Print</button></div><div class="printer-demo-to"><svg class="printer-demo-pipes printer-demo-pipes-down printer-demo-pipes-out" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="printer-demo-pipe" d="M50 0 C 50 38, 16.5 38, 16.5 100" /><path class="printer-demo-pipe" d="M50 0 V 100" /><path class="printer-demo-pipe" d="M50 0 C 50 38, 83.5 38, 83.5 100" /></svg><p class="printer-demo-label">Take it with you</p><div class="printer-demo-outputs"><div class="printer-demo-pipe-well printer-demo-pipe-well-out"><svg class="printer-demo-pipes printer-demo-pipes-across" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="printer-demo-pipe" d="M0 50 C 38 50, 38 16.5, 100 16.5" /><path class="printer-demo-pipe" d="M0 50 H 100" /><path class="printer-demo-pipe" d="M0 50 C 38 50, 38 83.5, 100 83.5" /></svg></div><div class="printer-demo-places"><div class="printer-demo-place"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2.3"/><path d="M15 13a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z"/></svg><span class="printer-demo-source-copy"><strong>Wallet</strong><span>In a pocket</span></span></div><div class="printer-demo-place"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect x="8" y="2" width="14" height="20" rx="2"/><path d="M11 6h5"/><path d="M11 10h5"/><path d="M11 14h5"/><path d="M11 18h5"/></svg><span class="printer-demo-source-copy"><strong>Notebook</strong><span>On the desk</span></span></div><div class="printer-demo-place"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span class="printer-demo-source-copy"><strong>Tote</strong><span>Out the door</span></span></div></div></div></div></div><a class="printer-demo-cta" href="/app">Launch editor</a></section>
  </main>`;
}

function guideHeader() {
  return `<header class="public-header"><div>${brand()}<nav><a href="/">Home</a><a href="/guides">Guides</a><a href="${site.hero.publicHref}">Setup</a></nav></div></header>`;
}

function guideIndexBody() {
  const cards = guides.map((guide) => `<article class="guide-index-card"><span>${escapeHtml(guide.topics[0])}</span><h2><a href="/guides/${guide.slug}">${escapeHtml(guide.title)}</a></h2><p>${escapeHtml(guide.description)}</p><small>Updated ${escapeHtml(guide.updated)}</small></article>`).join("");
  return `${guideHeader()}<main class="guide-index"><div class="guide-index-intro"><span>Thermal printer workshop</span><h1>Useful notes for putting an AI agent beside a roll of paper.</h1><p>Hardware choices, exact paper widths, local setup, and the approval boundary between an agent and a physical printer.</p></div><div class="guide-index-grid">${cards}</div></main>${footer()}`;
}

function guideBody(guide) {
  const body = marked.parse(guide.markdown);
  const card = site.guides.find((candidate) => candidate.slug === guide.slug);
  if (!card?.media) throw new Error(`${guide.slug} needs guide media in site.json.`);
  const media = `<figure class="guide-printer-photo"><img src="${card.media.src}" alt="${escapeHtml(card.media.alt)}"/><figcaption>${escapeHtml(card.media.caption)}</figcaption></figure>`;
  return `${guideHeader()}<main class="guide-shell"><nav class="guide-breadcrumb" aria-label="Breadcrumb"><a href="/guides">Thermal printer workshop</a><span>/</span><span>${escapeHtml(guide.title)}</span></nav><article class="guide-article"><header><span>${escapeHtml(guide.topics[0])}</span><h1>${escapeHtml(guide.title)}</h1><p>${escapeHtml(guide.summary)}</p><div><time datetime="${guide.updated}">Updated ${guide.updated}</time><span>First-hand workshop guide</span></div></header>${media}<div class="guide-body">${body}</div></article><aside class="guide-next"><strong>Keep reading</strong><div>${guides.filter((candidate) => candidate.slug !== guide.slug).slice(0, 2).map((candidate) => `<a href="/guides/${candidate.slug}">${escapeHtml(candidate.title)} →</a>`).join("")}</div></aside></main>${footer()}`;
}

const homeSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: site.name, url: absolute("/"), description: site.meta.description },
    { "@type": "SoftwareApplication", name: site.name, url: absolute("/"), description: site.meta.description, applicationCategory: "UtilitiesApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@type": "FAQPage", mainEntity: site.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
  ],
};

await writeFile(join(dist, "index.html"), pageHtml({ title: site.meta.title, description: site.meta.description, pathname: "/", markdownPath: "/index.md", body: landingBody(), schema: homeSchema, interactive: true }));

const guidesDescription = "First-hand thermal-printer guides covering hardware, paper width, Epson TM-L90 setup, ESC/POS, WebMCP, and safe AI-agent printing.";
const guidesSchema = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Thermal printer workshop", description: guidesDescription, url: absolute("/guides") };
await mkdir(join(dist, "guides"), { recursive: true });
await writeFile(join(dist, "guides", "index.html"), pageHtml({ title: `Thermal printer workshop — ${site.name}`, description: guidesDescription, pathname: "/guides", markdownPath: "/guides/index.md", body: guideIndexBody(), schema: guidesSchema }));

for (const guide of guides) {
  const directory = join(dist, "guides", guide.slug);
  await mkdir(directory, { recursive: true });
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: guide.title, description: guide.description, datePublished: guide.published, dateModified: guide.updated, mainEntityOfPage: absolute(`/guides/${guide.slug}`), author: { "@type": "Organization", name: site.name }, publisher: { "@type": "Organization", name: site.name } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absolute("/") },
        { "@type": "ListItem", position: 2, name: "Thermal printer workshop", item: absolute("/guides") },
        { "@type": "ListItem", position: 3, name: guide.title, item: absolute(`/guides/${guide.slug}`) },
      ] },
    ],
  };
  await writeFile(join(directory, "index.html"), pageHtml({ title: `${guide.title} — ${site.name}`, description: guide.description, pathname: `/guides/${guide.slug}`, markdownPath: `/guides/${guide.slug}.md`, body: guideBody(guide), schema }));
}

const sitemapFooter = `## Sitemap\n\n- [${site.name}](${absolute("/index.md")})\n- [Thermal printer workshop](${absolute("/guides/index.md")})\n${guides.map((guide) => `- [${guide.title}](${absolute(`/guides/${guide.slug}.md`)})`).join("\n")}`;
const homeMarkdown = `---\ntitle: ${site.meta.title}\ndescription: ${site.meta.description}\ncanonical_url: ${absolute("/")}\nmd_url: ${absolute("/index.md")}\nlast_updated: ${site.updated}\n---\n\n# ${site.hero.heading}\n\n${site.hero.copy}\n\n## How it works\n\n${site.steps.map((step) => `### ${step.title}\n\n${step.copy}`).join("\n\n")}\n\n## Built for agents, too\n\n${site.name} is a WebMCP app, so a compatible agent can draft, edit, and preview the same receipt a person sees, then ask before anything prints.\n\n## Thermal printer workshop\n\n${guides.map((guide) => `- [${guide.title}](${absolute(`/guides/${guide.slug}.md`)}): ${guide.description}`).join("\n")}\n\n## Questions\n\n${site.faqs.map((faq) => `### ${faq.question}\n\n${faq.answer}`).join("\n\n")}\n\n${sitemapFooter}\n`;
await writeFile(join(dist, "index.md"), homeMarkdown);

const guideIndexMarkdown = `---\ntitle: Thermal printer workshop\ndescription: ${guidesDescription}\ncanonical_url: ${absolute("/guides")}\nmd_url: ${absolute("/guides/index.md")}\nlast_updated: ${site.updated}\n---\n\n# Thermal printer workshop\n\n${guidesDescription}\n\n${guides.map((guide) => `## [${guide.title}](${absolute(`/guides/${guide.slug}.md`)})\n\n${guide.description}`).join("\n\n")}\n\n${sitemapFooter}\n`;
await writeFile(join(dist, "guides", "index.md"), guideIndexMarkdown);

for (const guide of guides) {
  const frontmatter = `---\ntitle: ${guide.title}\ndescription: ${guide.description}\ncanonical_url: ${absolute(`/guides/${guide.slug}`)}\nmd_url: ${absolute(`/guides/${guide.slug}.md`)}\npublished: ${guide.published}\nlast_updated: ${guide.updated}\n---`;
  await writeFile(join(dist, "guides", `${guide.slug}.md`), `${frontmatter}\n\n${guide.markdown}\n\n${sitemapFooter}\n`);
}

const sitemapEntries = [
  { pathname: "/", updated: site.updated },
  { pathname: "/guides", updated: site.updated },
  ...guides.map((guide) => ({ pathname: `/guides/${guide.slug}`, updated: guide.updated })),
];
await writeFile(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((entry) => `  <url><loc>${xml(absolute(entry.pathname))}</loc><lastmod>${entry.updated}</lastmod></url>`).join("\n")}\n</urlset>\n`);
await writeFile(join(dist, "sitemap.md"), `# ${site.name} sitemap\n\n## Product\n\n- [${site.name}](${absolute("/")}): ${site.meta.description}\n\n## Thermal printer workshop\n\n- [Workshop index](${absolute("/guides")}): ${guidesDescription}\n${guides.map((guide) => `- [${guide.title}](${absolute(`/guides/${guide.slug}`)}): ${guide.description}`).join("\n")}\n`);
await writeFile(join(dist, "llms.txt"), `# ${site.name}\n\n> A local-first AI thermal-printer and receipt editor, physically tested with an Epson TM-L90 over native USB.\n\n## Product\n\n- [Overview](${absolute("/index.md")})\n- [Installation and agent usage](${absolute("/AGENTS.md")})\n\n## Thermal printer workshop\n\n${guides.map((guide) => `- [${guide.title}](${absolute(`/guides/${guide.slug}.md`)})`).join("\n")}\n\n## Site map\n\n- [Semantic sitemap](${absolute("/sitemap.md")})\n`);
await writeFile(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /setup\nDisallow: /blocks\nDisallow: /api/\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: Claude-SearchBot\nAllow: /\n\nUser-agent: Claude-User\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nSitemap: ${absolute("/sitemap.xml")}\n`);
await writeFile(join(dist, "AGENTS.md"), `${await readFile(join(contentDirectory, "AGENTS.md"), "utf8")}\n\n${sitemapFooter}\n`);

const privateBody = (name, browserDemo = false) => browserDemo
  ? `<main class="private-public-shell"><div>${brand()}<h1>Opening the receipt editor…</h1><p>The live browser editor needs JavaScript. It saves receipts on this device and does not contact the local printer bridge.</p></div></main>`
  : `<main class="private-public-shell"><div>${brand()}<h1>${name} runs locally.</h1><p>The public site does not expose printer setup or the local bridge. Install ${escapeHtml(site.name)} beside the thermal printer to use this surface.</p><a class="button primary" href="${site.hero.publicHref}">Open the setup guide</a></div></main>`;
for (const [pathname, name] of [["app", "The receipt editor"], ["setup", "Printer setup"], ["blocks", "The block playground"], ["blocks/charts", "The chart lab"]]) {
  const directory = join(dist, pathname);
  await mkdir(directory, { recursive: true });
  const browserDemo = pathname === "app";
  await writeFile(join(directory, "index.html"), pageHtml({ title: `${name} — ${site.name}`, description: browserDemo ? `Try the ${site.name} receipt editor in this browser.` : `This ${site.name} surface runs only on the local bridge.`, pathname: `/${pathname}`, body: privateBody(name, browserDemo), robots: "noindex,nofollow", interactive: browserDemo }));
}

const notFound = `${guideHeader()}<main class="private-public-shell"><div><h1>That page is not on this roll.</h1><p>Try the thermal printer workshop or return to ${escapeHtml(site.name)}.</p><a class="button primary" href="/guides">Browse the guides</a></div></main>${footer()}`;
await writeFile(join(dist, "404.html"), pageHtml({ title: `Page not found — ${site.name}`, description: `The requested ${site.name} page does not exist.`, pathname: "/404", body: notFound, robots: "noindex,nofollow" }));
await writeFile(join(dist, ".public-site"), `${origin}\n`);
