import { useEffect } from "react";
import { marked } from "marked";
import { useParams } from "react-router-dom";
import siteContent from "../../content/site.json";
import paperGuide from "../../content/guides/58mm-vs-80mm-thermal-paper.md?raw";
import printerGuide from "../../content/guides/best-thermal-printer-for-ai-projects.md?raw";
import setupGuide from "../../content/guides/epson-tm-l90-ai-printer-setup.md?raw";
import agentsGuide from "../../content/guides/how-ai-agents-print-with-webmcp.md?raw";
import { Brand } from "../components/Brand";

const guideSources: Record<string, string> = {
  "best-thermal-printer-for-ai-projects": printerGuide,
  "epson-tm-l90-ai-printer-setup": setupGuide,
  "58mm-vs-80mm-thermal-paper": paperGuide,
  "how-ai-agents-print-with-webmcp": agentsGuide,
};

function readGuide(source: string) {
  const parsed = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!parsed) throw new Error("Guide frontmatter is invalid.");
  const field = (name: string) => parsed[1].match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim() ?? "";
  return {
    summary: field("summary"),
    updated: field("updated"),
    html: marked.parse(parsed[2]) as string,
  };
}

function GuideHeader() {
  return <header className="public-header"><div>
    <a className="public-brand-link" href="/"><Brand /></a>
    <nav><a href="/">Home</a><a href="/guides">Guides</a><a href="/guides/epson-tm-l90-ai-printer-setup">Setup</a></nav>
  </div></header>;
}

function GuideFooter() {
  return <footer className="landing-footer public-footer"><Brand compact /><div><a href="/guides">Thermal printer guides</a><span>Made to be used.</span></div></footer>;
}

export function GuidesPage() {
  useEffect(() => { document.title = `Thermal printer workshop — ${siteContent.name}`; }, []);
  return <>
    <GuideHeader />
    <main className="guide-index">
      <div className="guide-index-intro">
        <span>Thermal printer workshop</span>
        <h1>Useful notes for putting an AI agent beside a roll of paper.</h1>
        <p>Hardware choices, exact paper widths, local setup, and the approval boundary between an agent and a physical printer.</p>
      </div>
      <div className="guide-index-grid">
        {siteContent.guides.map((guide) => <article className="guide-index-card" key={guide.slug}>
          <span>Guide</span>
          <h2><a href={`/guides/${guide.slug}`}>{guide.title}</a></h2>
          <p>{guide.description}</p>
          <small>Updated {siteContent.updated}</small>
        </article>)}
      </div>
    </main>
    <GuideFooter />
  </>;
}

export function GuidePage({ slug: suppliedSlug }: { slug?: string } = {}) {
  const { slug: routeSlug = "" } = useParams();
  const slug = suppliedSlug ?? routeSlug;
  const card = siteContent.guides.find((guide) => guide.slug === slug);
  const source = guideSources[slug];
  const guide = source ? readGuide(source) : undefined;

  useEffect(() => { document.title = card ? `${card.title} — ${siteContent.name}` : `Guide not found — ${siteContent.name}`; }, [card]);

  if (!card || !guide) return <>
    <GuideHeader />
    <main className="private-public-shell"><div><h1>That guide is not on this roll.</h1><p>Return to the workshop to choose one of the four guides.</p><a className="button primary" href="/guides">Browse the guides</a></div></main>
    <GuideFooter />
  </>;

  const related = siteContent.guides.filter((candidate) => candidate.slug !== slug).slice(0, 2);
  return <>
    <GuideHeader />
    <main className="guide-shell">
      <nav className="guide-breadcrumb" aria-label="Breadcrumb"><a href="/guides">Thermal printer workshop</a><span>/</span><span>{card.title}</span></nav>
      <article className="guide-article">
        <header>
          <span>Workshop guide</span>
          <h1>{card.title}</h1>
          <p>{guide.summary}</p>
          <div><time dateTime={guide.updated}>Updated {guide.updated}</time><span>First-hand workshop guide</span></div>
        </header>
        <figure className="guide-printer-photo"><img src={card.media.src} alt={card.media.alt} /><figcaption>{card.media.caption}</figcaption></figure>
        <div className="guide-body" dangerouslySetInnerHTML={{ __html: guide.html }} />
      </article>
      <aside className="guide-next"><strong>Keep reading</strong><div>{related.map((candidate) => <a href={`/guides/${candidate.slug}`} key={candidate.slug}>{candidate.title} →</a>)}</div></aside>
    </main>
    <GuideFooter />
  </>;
}
