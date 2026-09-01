import { useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, Plus, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { blockCatalog, prototypeCategories } from "../blocks/catalog";
import { designStudyIds } from "../block-library";
import { geocodeCity, loadBlockFeeds } from "../blocks/feeds";
import { createSampleSnapshot, newYorkLocation } from "../blocks/fixtures";
import { renderPrototypeBlock } from "../blocks/render";
import type { BlockPrototype, DataState, FeedSnapshot, PaperWidthDots, PrototypeBlockId } from "../blocks/types";
import { Brand } from "../components/Brand";
import { PaperSurface } from "../components/PaperSurface";

const basicBlocks = ["Heading", "Text", "Checklist", "Key / value", "Table", "Divider"];

function stateLabel(state: DataState) {
  if (state === "live") return "Live data";
  if (state === "sample-fallback") return "Sample fallback";
  if (state === "loading") return "Loading live data";
  return "Sample data";
}

function PrototypePaper({ prototype, snapshot, width, className = "" }: { prototype: BlockPrototype; snapshot: FeedSnapshot; width: PaperWidthDots; className?: string }) {
  const rendered = useMemo(() => renderPrototypeBlock(prototype.id, snapshot.data[prototype.id] as never, width), [prototype.id, snapshot.data, width]);
  return <PaperSurface
    className={`prototype-paper ${className}`}
    style={{ aspectRatio: `${rendered.width} / ${rendered.height}` }}
    dangerouslySetInnerHTML={{ __html: rendered.svg }}
  />;
}

function Modal({ labelId, onClose, className = "", children }: { labelId: string; onClose(): void; className?: string; children: ReactNode }) {
  const modalRef = useRef<HTMLElement>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    modalRef.current?.querySelector<HTMLElement>("button, input, a")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, []);
  return <div className="blocks-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section ref={modalRef} className={`blocks-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelId}>{children}</section>
  </div>;
}

function CatalogModal({ snapshot, width, onChoose, onClose }: { snapshot: FeedSnapshot; width: PaperWidthDots; onChoose(id: PrototypeBlockId): void; onClose(): void }) {
  const [query, setQuery] = useState("");
  const visible = blockCatalog.filter((prototype) => `${prototype.name} ${prototype.description} ${prototype.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Modal labelId="blocks-catalog-title" onClose={onClose} className="catalog-modal">
    <header className="blocks-modal-header"><div><span>Review-only catalog</span><h2 id="blocks-catalog-title">More blocks</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close block catalog"><X size={18} /></button></header>
    <div className="catalog-search"><Search size={16} aria-hidden="true" /><input autoFocus aria-label="Search blocks" placeholder="Search weather, agenda, scores…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="catalog-list">
      {prototypeCategories.map((category) => {
        const items = visible.filter((prototype) => prototype.category === category);
        if (!items.length) return null;
        return <section className="catalog-section" key={category}><h3>{category}</h3><div className="catalog-items">{items.map((prototype) => <button type="button" className="catalog-item" key={prototype.id} onClick={() => onChoose(prototype.id)}>
          <PrototypePaper prototype={prototype} snapshot={snapshot} width={width} className="catalog-thumbnail" />
          <span><strong>{prototype.name}</strong><small>{prototype.description}</small></span>
          <span className={`prototype-source state-${snapshot.states[prototype.id]}`}>{stateLabel(snapshot.states[prototype.id])}</span>
        </button>)}</div></section>;
      })}
      {!visible.length && <div className="catalog-empty"><strong>No blocks found</strong><span>Try a broader word or browse the contact sheet.</span></div>}
    </div>
  </Modal>;
}

function FocusModal({ prototype, snapshot, width, onClose }: { prototype: BlockPrototype; snapshot: FeedSnapshot; width: PaperWidthDots; onClose(): void }) {
  return <Modal labelId="block-focus-title" onClose={onClose} className="focus-modal">
    <header className="blocks-modal-header"><div><span>{prototype.category} · {width === 576 ? "80 mm" : "58 mm"}</span><h2 id="block-focus-title">{prototype.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close focused preview"><X size={18} /></button></header>
    <div className="focus-stage"><PrototypePaper prototype={prototype} snapshot={snapshot} width={width} className={`focus-paper ${width === 420 ? "paper-narrow" : ""}`} /></div>
    <footer className="focus-notes"><p>{prototype.designNote}</p><div><span className={`prototype-source state-${snapshot.states[prototype.id]}`}>{stateLabel(snapshot.states[prototype.id])}</span>{prototype.sourceUrl && <a href={prototype.sourceUrl} target="_blank" rel="noreferrer">{prototype.sourceName}<ExternalLink size={12} /></a>}</div></footer>
  </Modal>;
}

export function BlocksPage() {
  const [width, setWidth] = useState<PaperWidthDots>(576);
  const [snapshot, setSnapshot] = useState(() => createSampleSnapshot());
  const [location, setLocation] = useState(newYorkLocation);
  const [city, setCity] = useState("New York");
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<PrototypeBlockId>();
  const locationRequestRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    loadBlockFeeds(location, { signal: controller.signal }).then(setSnapshot).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSnapshot((current) => ({ ...current, states: Object.fromEntries(Object.entries(current.states).map(([id, state]) => [id, state === "sample" ? state : "sample-fallback"])) as FeedSnapshot["states"] }));
    });
    return () => controller.abort();
  }, [location]);

  useEffect(() => () => locationRequestRef.current?.abort(), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && addMenuOpen) setAddMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [addMenuOpen]);

  const submitLocation = async (event: FormEvent) => {
    event.preventDefault();
    locationRequestRef.current?.abort();
    const controller = new AbortController();
    locationRequestRef.current = controller;
    setLocationBusy(true);
    setLocationError("");
    try {
      const nextLocation = await geocodeCity(city, { signal: controller.signal });
      setSnapshot(createSampleSnapshot(nextLocation));
      setLocation(nextLocation);
    }
    catch (error) { setLocationError(error instanceof Error ? error.message : "Could not find that location."); }
    finally {
      if (locationRequestRef.current === controller) {
        locationRequestRef.current = undefined;
        setLocationBusy(false);
      }
    }
  };

  const chooseFromCatalog = (id: PrototypeBlockId) => {
    setCatalogOpen(false);
    setSelectedId(id);
  };
  const selected = selectedId ? blockCatalog.find((prototype) => prototype.id === selectedId) : undefined;
  const printable = blockCatalog.filter((prototype) => !designStudyIds.has(prototype.id));
  const studies = blockCatalog.filter((prototype) => designStudyIds.has(prototype.id));

  return <main className="blocks-page">
    <header className="blocks-header"><Brand compact /><div className="blocks-header-note"><span>Experimental surface</span><strong>Block playground</strong></div><div className="blocks-header-actions"><Link className="text-button" to="/blocks/charts">Chart lab</Link><Link className="text-button" to="/app"><ArrowLeft size={14} />Back to editor</Link></div></header>
    <section className="blocks-intro">
      <div><span className="kicker">Physical information, one block at a time</span><h1>Blocks are the fun part.</h1><p>Small, useful pieces of the world—some filled by data, others deliberately left open for a pen, all designed for one-bit ink and narrow paper.</p></div>
      <div className="blocks-controls">
        <div className="blocks-control-row"><span>Paper</span><div className="paper-switch" role="group" aria-label="Preview paper width"><button type="button" className={width === 576 ? "selected" : ""} aria-pressed={width === 576} onClick={() => setWidth(576)}>80 mm</button><button type="button" className={width === 420 ? "selected" : ""} aria-pressed={width === 420} onClick={() => setWidth(420)}>58 mm</button></div></div>
        <form className="location-control" onSubmit={(event) => void submitLocation(event)}><label htmlFor="block-city">Local data</label><div><input id="block-city" value={city} onChange={(event) => setCity(event.target.value)} /><button type="submit" disabled={locationBusy}>{locationBusy ? "Finding…" : "Update"}</button></div><small className={locationError ? "error" : ""}>{locationError || location.name}</small></form>
        <div className="prototype-add-control"><button type="button" className="button primary" aria-expanded={addMenuOpen} onClick={() => setAddMenuOpen((value) => !value)}><Plus size={15} />Add block<ChevronDown size={14} /></button>{addMenuOpen && <div className="prototype-add-menu">{basicBlocks.map((name) => <button type="button" key={name} onClick={() => setAddMenuOpen(false)}>{name}<small>Available in editor</small></button>)}<i /><button type="button" className="more-blocks-button" onClick={() => { setAddMenuOpen(false); setCatalogOpen(true); }}>More blocks…<span>{blockCatalog.length} ideas</span></button></div>}</div>
      </div>
    </section>

    <section className="contact-sheet" aria-labelledby="contact-sheet-title">
      <header><div><span>Design review · write-in pass</span><h2 id="contact-sheet-title">{printable.length} printable pieces</h2></div><p>Every paper surface below is rendered in printer dots. Click one to inspect it at full scale.</p></header>
      <div className={`prototype-grid paper-${width}`}>{printable.map((prototype, index) => <article className="prototype-card" id={`prototype-${prototype.id}`} key={prototype.id}>
        <div className="prototype-card-heading"><div><span>{String(index + 1).padStart(2, "0")} · {prototype.category}</span><h3>{prototype.name}</h3></div><span className={`prototype-source state-${snapshot.states[prototype.id]}`}>{stateLabel(snapshot.states[prototype.id])}</span></div>
        <button type="button" className="prototype-preview-button" onClick={() => setSelectedId(prototype.id)} aria-label={`Focus ${prototype.name} preview`}><PrototypePaper prototype={prototype} snapshot={snapshot} width={width} /></button>
        <p>{prototype.description}</p>
        <footer><span>{width} dots</span>{prototype.sourceUrl ? <a href={prototype.sourceUrl} target="_blank" rel="noreferrer">{prototype.sourceName}<ExternalLink size={11} /></a> : <span>Deterministic sample</span>}</footer>
      </article>)}</div>
    </section>

    <section className="contact-sheet" aria-labelledby="design-studies-title">
      <header><div><span>Not printable</span><h2 id="design-studies-title">Design studies</h2></div><p>These have no data source behind them. They render invented numbers, so they stay off real paper until a feed exists.</p></header>
      <div className={`prototype-grid paper-${width}`}>{studies.map((prototype, index) => <article className="prototype-card study" id={`prototype-${prototype.id}`} key={prototype.id}>
        <div className="prototype-card-heading"><div><span>{String(index + 1).padStart(2, "0")} · {prototype.category}</span><h3>{prototype.name}</h3></div><span className="prototype-source state-sample">Invented data</span></div>
        <button type="button" className="prototype-preview-button" onClick={() => setSelectedId(prototype.id)} aria-label={`Focus ${prototype.name} preview`}><PrototypePaper prototype={prototype} snapshot={snapshot} width={width} /></button>
        <p>{prototype.description}</p>
        <footer><span>{width} dots</span><span>No feed yet</span></footer>
      </article>)}</div>
    </section>
    <footer className="blocks-footer"><strong>PETE’S PRINTER</strong><span>Nothing on this page changes your saved receipt.</span><Link to="/app">Return to the editor</Link></footer>
    {catalogOpen && <CatalogModal snapshot={snapshot} width={width} onChoose={chooseFromCatalog} onClose={() => setCatalogOpen(false)} />}
    {selected && <FocusModal prototype={selected} snapshot={snapshot} width={width} onClose={() => setSelectedId(undefined)} />}
  </main>;
}
