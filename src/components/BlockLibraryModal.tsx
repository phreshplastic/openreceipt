import { ExternalLink, Plus, Search, Star, X } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  configDescriptorFor,
  getLibraryDefinition,
  initialConfigValues,
  isAvailableCatalogKind,
  libraryDefinitions,
  missingRequiredField,
  renderLibraryPreview,
  type CatalogInsertConfig,
  type ConfigValues,
  type UserDefaults,
} from "../block-library";
import { ConfigFields } from "./ConfigFields";
import { LibraryGlyph } from "./LibraryGlyph";
import type { CatalogBlockKind } from "../receipt";
import type { PaperWidthDots, PrototypeBlockId } from "../blocks/types";
import { PaperSurface } from "./PaperSurface";

const categories = ["All", "Favorites", "Identity", "Daily", "Live data", "Write-in", "Getting around", "Home & life"] as const;

function LibraryPaper({ id, width, className = "" }: { id: PrototypeBlockId; width: PaperWidthDots; className?: string }) {
  const rendered = useMemo(() => renderLibraryPreview(id, width), [id, width]);
  return <PaperSurface className={`library-paper ${className}`} style={{ aspectRatio: `${rendered.width} / ${rendered.height}` }} dangerouslySetInnerHTML={{ __html: rendered.svg }} />;
}

type Props = {
  width: PaperWidthDots;
  favoriteIds: CatalogBlockKind[];
  initialId?: PrototypeBlockId;
  defaults: UserDefaults;
  onToggleFavorite(id: CatalogBlockKind): void;
  onInsert(kind: CatalogBlockKind, config?: CatalogInsertConfig): Promise<void>;
  onClose(): void;
};

export function BlockLibraryModal({ width, favoriteIds, initialId, defaults, onToggleFavorite, onInsert, onClose }: Props) {
  const modalRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [selectedId, setSelectedId] = useState<PrototypeBlockId>(initialId ?? "weather");
  const [config, setConfig] = useState<ConfigValues>({});
  const [configuredId, setConfiguredId] = useState<PrototypeBlockId>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    modalRef.current?.querySelector<HTMLElement>("input, button, a")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, []);

  const filtered = libraryDefinitions.filter((definition) => {
    const matchesQuery = `${definition.name} ${definition.description} ${definition.category} ${definition.dataMode}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === "All"
      || category === "Favorites" && isAvailableCatalogKind(definition.id) && favoriteIds.includes(definition.id)
      || definition.category === category
      || definition.dataMode === category;
    return matchesQuery && matchesCategory;
  });
  const selected = getLibraryDefinition(selectedId) ?? libraryDefinitions[0];
  const descriptor = configDescriptorFor(selected.id);
  // Reset the form to this block's own defaults whenever the selection changes.
  if (configuredId !== selected.id) {
    setConfiguredId(selected.id);
    setConfig(descriptor ? initialConfigValues(descriptor, defaults) : {});
  }
  const missing = descriptor ? missingRequiredField(descriptor, config) : undefined;
  const selectedFavoriteId = isAvailableCatalogKind(selected.id) ? selected.id : undefined;
  const favorite = selectedFavoriteId ? favoriteIds.includes(selectedFavoriteId) : false;

  const insert = async () => {
    if (!isAvailableCatalogKind(selected.id)) return;
    setBusy(true);
    setError("");
    try {
      const insertConfig: CatalogInsertConfig = descriptor ? descriptor.toInsertConfig(config, defaults) : undefined;
      await onInsert(selected.id, insertConfig);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this block.");
    } finally { setBusy(false); }
  };

  return <div className="library-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section ref={modalRef} className="library-modal" role="dialog" aria-modal="true" aria-labelledby="block-library-title">
      <header className="library-header">
        <div><h2 id="block-library-title">Block Library</h2><p>Useful pieces, made for paper.</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close Block Library"><X size={17} /></button>
      </header>
      <div className="library-search"><Search size={15} aria-hidden="true" /><input aria-label="Search Block Library" placeholder="Search blocks" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <nav className="library-categories" aria-label="Block categories">
        {categories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}{item === "Favorites" && favoriteIds.length > 0 ? <span>{favoriteIds.length}</span> : null}</button>)}
      </nav>
      <div className="library-body">
        <div className="library-results" aria-live="polite">
          {filtered.length ? <div className="library-grid">{filtered.map((definition) => {
            const favoriteId = isAvailableCatalogKind(definition.id) ? definition.id : undefined;
            const isFavorite = favoriteId ? favoriteIds.includes(favoriteId) : false;
            return <article className={`library-card ${selected.id === definition.id ? "selected" : ""}`} key={definition.id}>
              <button type="button" className="library-card-main" aria-label={definition.name} aria-pressed={selected.id === definition.id} onClick={() => { setSelectedId(definition.id); setError(""); }}>
                <LibraryGlyph id={definition.id} />
                <div className="library-card-preview"><LibraryPaper id={definition.id} width={width} /></div>
                <span className="library-card-copy"><strong>{definition.name}</strong></span>
              </button>
              {favoriteId && <button type="button" className={`library-favorite ${isFavorite ? "active" : ""}`} aria-label={`${isFavorite ? "Remove" : "Add"} ${definition.name} ${isFavorite ? "from" : "to"} favorites`} aria-pressed={isFavorite} onClick={() => onToggleFavorite(favoriteId)}><Star size={14} fill={isFavorite ? "currentColor" : "none"} /></button>}
            </article>;
          })}</div> : <div className="library-empty"><Search size={22} /><strong>No matching blocks</strong><span>Try another word or category.</span></div>}
        </div>

        <aside className="library-detail">
          <div className="library-detail-preview"><LibraryPaper id={selected.id} width={width} /></div>
          <div className="library-detail-heading"><LibraryGlyph id={selected.id} /><div><span>{selected.category}</span><h3>{selected.name}</h3></div>{selectedFavoriteId && <button type="button" className={`library-detail-star ${favorite ? "active" : ""}`} onClick={() => onToggleFavorite(selectedFavoriteId)} aria-pressed={favorite}><Star size={15} fill={favorite ? "currentColor" : "none"} />{favorite ? "Favorited" : "Favorite"}</button>}</div>
          <p>{selected.designNote}</p>
          <div className="library-detail-meta"><span>{width === 576 ? "80 mm" : "58 mm"} receipt</span><span>{selected.availability === "available" ? selected.dataMode : "Preview only"}</span></div>

          {descriptor && <ConfigFields descriptor={descriptor} values={config} variant="modal" disabled={busy} onChange={setConfig} />}

          {error && <div className="library-error" role="alert">{error}</div>}
          <div className="library-detail-actions">
            {selected.availability === "available" && isAvailableCatalogKind(selected.id)
              ? <button type="button" className="button primary" disabled={busy || Boolean(missing)} onClick={() => void insert()}><Plus size={15} />{busy ? "Adding…" : missing ? `${missing.label} is needed` : "Add block"}</button>
              : <a className="button secondary" href={`/blocks#prototype-${selected.id}`} target="_blank" rel="noreferrer">Review in playground<ExternalLink size={13} /></a>}
            {selected.sourceUrl && <a className="library-source" href={selected.sourceUrl} target="_blank" rel="noreferrer">Data from {selected.sourceName}<ExternalLink size={11} /></a>}
          </div>
        </aside>
      </div>
    </section>
  </div>;
}
