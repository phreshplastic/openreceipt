import { AlignCenter, AlignLeft, AlignRight, Blocks, Bold, Check, ChevronRight, Italic, Plus, RotateCw, Star, Trash2, Underline } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { configDescriptorFor, getLibraryDefinition, initialConfigValues, isLiveCatalogBlock, missingRequiredField, renderLibraryPreview, type ConfigValues, type LiveCatalogBlock, type UserDefaults } from "../block-library";
import { ConfigFields } from "./ConfigFields";
import { createId, receiptTemplates, type CatalogBlockKind, type CatalogReceiptBlock, type ReceiptBlock, type ReceiptDocument } from "../receipt";
import type { PaperWidthDots } from "../blocks/types";
import { printPolicies, type AppSettings } from "../state/storage";
import { PaperSurface } from "./PaperSurface";

export type InspectorMode = "library" | "format" | "print";
type Props = {
  block?: ReceiptBlock;
  canRemove: boolean;
  mode: InspectorMode;
  favoriteIds: CatalogBlockKind[];
  paperWidth: PaperWidthDots;
  catalogBusy?: { id: string; kind: "refresh" | "reconfigure" };
  catalogError?: { id: string; message: string };
  page: ReceiptDocument["page"];
  settings: AppSettings;
  bridgeOnline: boolean;
  printStatus: string;
  webMcpAvailable: boolean;
  onModeChange(mode: InspectorMode): void;
  onChange(block: ReceiptBlock): void;
  onRemove(): void;
  onBrowseLibrary(): void;
  onInsertFavorite(id: CatalogBlockKind): void;
  onRefreshCatalog(id: string): Promise<void>;
  onReconfigureCatalog(id: string, values: ConfigValues): Promise<void>;
  onPageChange(page: ReceiptDocument["page"]): void;
  onSettingsChange(settings: AppSettings): void;
};
type TextualBlock = Extract<ReceiptBlock, { type: "heading" | "text" }>;

function blockName(block: ReceiptBlock) {
  if (block.type === "keyValue") return "Key / value";
  if (block.type === "catalog") return getLibraryDefinition(block.kind)?.name ?? "Library block";
  return block.type[0].toUpperCase() + block.type.slice(1);
}

function InspectorTabs({ mode, onChange }: { mode: InspectorMode; onChange(mode: InspectorMode): void }) {
  return <div className="inspector-bar"><div className="inspector-tabs" role="tablist" aria-label="Inspector view">
    <button type="button" role="tab" aria-selected={mode === "library"} className={mode === "library" ? "active" : ""} onClick={() => onChange("library")}>Library</button>
    <button type="button" role="tab" aria-selected={mode === "format"} className={mode === "format" ? "active" : ""} onClick={() => onChange("format")}>Format</button>
    <button type="button" role="tab" aria-selected={mode === "print"} className={mode === "print" ? "active" : ""} onClick={() => onChange("print")}>Print</button>
  </div></div>;
}

function FavoritePreview({ id, width }: { id: CatalogBlockKind; width: PaperWidthDots }) {
  const rendered = useMemo(() => renderLibraryPreview(id, width), [id, width]);
  return <PaperSurface className="inspector-favorite-paper" style={{ aspectRatio: `${rendered.width} / ${rendered.height}` }} dangerouslySetInnerHTML={{ __html: rendered.svg }} />;
}

function BlocksShelf({ favoriteIds, paperWidth, onBrowseLibrary, onInsertFavorite }: Pick<Props, "favoriteIds" | "paperWidth" | "onBrowseLibrary" | "onInsertFavorite">) {
  if (!favoriteIds.length) return <div className="blocks-shelf-empty"><span className="blocks-shelf-mark"><Star size={18} /></span><strong>Your favorite blocks live here.</strong><p>Favorite a block in the library to keep it close whenever you’re building a receipt.</p><button type="button" className="button secondary" onClick={onBrowseLibrary}><Blocks size={14} />Browse Block Library</button></div>;
  return <div className="blocks-shelf"><header><div><strong>Favorites</strong><span>{favoriteIds.length} saved</span></div><button type="button" onClick={onBrowseLibrary}>Browse all</button></header><div className="blocks-shelf-list">{favoriteIds.map((id) => {
    const definition = getLibraryDefinition(id);
    if (!definition) return null;
    return <article className="blocks-shelf-item" key={id}><div className="blocks-shelf-preview"><FavoritePreview id={id} width={paperWidth} /></div><div><strong>{definition.name}</strong><span>{definition.dataMode}</span></div><button type="button" className="icon-button" aria-label={`Add ${definition.name}`} title={`Add ${definition.name}`} onClick={() => onInsertFavorite(id)}><Plus size={15} /></button></article>;
  })}</div></div>;
}

function InspectorSection({ label, children }: { label: string; children: ReactNode }) {
  return <section className="inspector-section"><h3>{label}</h3>{children}</section>;
}

function Alignment({ value, onChange }: { value: "left" | "center" | "right"; onChange(value: "left" | "center" | "right"): void }) {
  return <div className="segmented icon-segmented" role="group" aria-label="Alignment">
    {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => <button type="button" aria-label={`Align ${align}`} aria-pressed={value === align} className={value === align ? "active" : ""} key={align} onClick={() => onChange(align)}><Icon size={15} /></button>)}
  </div>;
}

function TextStyleControls({ block, onChange }: { block: TextualBlock; onChange(block: TextualBlock): void }) {
  return <>
    <InspectorSection label="Typography">
      <label className="inspector-control-row"><span>Preset</span>{block.type === "heading"
        ? <select value={block.level} onChange={(event) => onChange({ ...block, level: event.target.value as typeof block.level })}><option value="display">Display</option><option value="heading">Heading</option><option value="section">Section</option></select>
        : <select value={block.size} onChange={(event) => onChange({ ...block, size: event.target.value as typeof block.size })}><option value="small">Small</option><option value="body">Body</option><option value="large">Large</option></select>}
      </label>
      <div className="inspector-control-row"><span>Style</span><div className="style-controls" role="group" aria-label="Text style">
        <button type="button" aria-label="Bold" aria-pressed={block.weight === "bold"} className={block.weight === "bold" ? "active" : ""} onClick={() => onChange({ ...block, weight: block.weight === "bold" ? "regular" : "bold" })}><Bold size={15} /></button>
        <button type="button" aria-label="Italic" aria-pressed={block.italic} className={block.italic ? "active" : ""} onClick={() => onChange({ ...block, italic: !block.italic })}><Italic size={15} /></button>
        <button type="button" aria-label="Underline" aria-pressed={block.underline} className={block.underline ? "active" : ""} onClick={() => onChange({ ...block, underline: !block.underline })}><Underline size={15} /></button>
      </div></div>
      <div className="inspector-control-row"><span>Alignment</span><Alignment value={block.align} onChange={(align) => onChange({ ...block, align })} /></div>
    </InspectorSection>
    <details className="inspector-disclosure">
      <summary><ChevronRight size={13} /><span>Text content</span></summary>
      <div><textarea className="inspector-textarea" aria-label="Block text" rows={block.type === "heading" ? 3 : 5} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></div>
    </details>
  </>;
}

function PrintPanel({ page, settings, bridgeOnline, printStatus, webMcpAvailable, onPageChange, onSettingsChange }: Pick<Props, "page" | "settings" | "bridgeOnline" | "printStatus" | "webMcpAvailable" | "onPageChange" | "onSettingsChange">) {
  const profiles = [
    { paperWidthMm: 80 as const, printableWidthDots: 576 as const, paddingDots: 28, label: "80 mm", detail: "576 dots" },
    { paperWidthMm: 58 as const, printableWidthDots: 420 as const, paddingDots: 22, label: "58 mm", detail: "420 dots" },
  ];
  return <div className="print-panel">
    <InspectorSection label="Paper size"><div className="paper-profile-options">{profiles.map((profile) => <button type="button" key={profile.paperWidthMm} aria-pressed={page.paperWidthMm === profile.paperWidthMm} className={page.paperWidthMm === profile.paperWidthMm ? "selected" : ""} onClick={() => onPageChange(profile)}><span className="radio">{page.paperWidthMm === profile.paperWidthMm && <Check size={11} />}</span><span><strong>{profile.label}</strong><small>{profile.detail}</small></span></button>)}</div></InspectorSection>
    <InspectorSection label="Home">
      <div className="inspector-control-stack">
        <label className="inspector-control-row"><span>City</span><input aria-label="Home city" placeholder="City or postal code" value={settings.defaultLocation} onChange={(event) => onSettingsChange({ ...settings, defaultLocation: event.target.value })} /></label>
        <label className="inspector-control-row"><span>Units</span><select value={settings.defaultUnit} onChange={(event) => onSettingsChange({ ...settings, defaultUnit: event.target.value as AppSettings["defaultUnit"] })}><option value="fahrenheit">Fahrenheit</option><option value="celsius">Celsius</option></select></label>
      </div>
      <p className="catalog-form-note">Where new weather, air and surf blocks start. Each block can point somewhere else.</p>
    </InspectorSection>
    <InspectorSection label="Printer"><div className="printer-summary"><span className={`status-dot ${bridgeOnline ? "online" : ""}`} /><div><strong>{bridgeOnline ? "Local printer ready" : "Printer offline"}</strong><small>{printStatus || (bridgeOnline ? "Local bridge" : "Click the status in the toolbar to retry")}</small></div></div></InspectorSection>
    <InspectorSection label="Agent printing"><div className="inspector-policy-options">{printPolicies.map((policy) => <button type="button" key={policy.id} className={settings.printPolicy === policy.id ? "selected" : ""} onClick={() => onSettingsChange({ ...settings, printPolicy: policy.id })}><span className="radio">{settings.printPolicy === policy.id && <Check size={11} />}</span><span><strong>{policy.name}</strong><small>{policy.description}</small></span></button>)}</div>
      {settings.printPolicy === "approved" && <div className="inspector-trusted-templates"><span>Approved templates</span>{receiptTemplates.map((template) => <label key={template.id}><input type="checkbox" checked={settings.trustedTemplateIds.includes(template.id)} onChange={(event) => onSettingsChange({ ...settings, trustedTemplateIds: event.target.checked ? [...settings.trustedTemplateIds, template.id] : settings.trustedTemplateIds.filter((id) => id !== template.id) })} /><span>{template.name}</span></label>)}</div>}
    </InspectorSection>
    <div className="inspector-agent-status"><span className={`status-dot ${webMcpAvailable ? "online" : ""}`} /><span>{webMcpAvailable ? "Agent tools available" : "Agent tools unavailable"}</span></div>
  </div>;
}

type CatalogEditorProps = {
  block: CatalogReceiptBlock;
  busy?: "refresh" | "reconfigure";
  error?: string;
  defaults: UserDefaults;
  onChange(block: CatalogReceiptBlock): void;
  onRefresh(): Promise<void>;
  onReconfigure(values: ConfigValues): Promise<void>;
};

/** Repeating list of lines, in the same shape as the core checklist editor. */
function LineList({ label, addLabel, canAdd, children, onAdd }: { label: string; addLabel: string; canAdd: boolean; children: ReactNode; onAdd(): void }) {
  return <InspectorSection label={label}><div className="structured-editor">
    {children}
    <button type="button" className="add-line" disabled={!canAdd} onClick={onAdd}><Plus size={14} />{addLabel}</button>
  </div></InspectorSection>;
}

function TickBox({ checked, label, onChange }: { checked: boolean; label: string; onChange(): void }) {
  return <button type="button" className={`check-button ${checked ? "checked" : ""}`} aria-label={label} aria-pressed={checked} onClick={onChange}>{checked && <Check size={13} />}</button>;
}

/** Status, editable config and a refresh, for anything backed by a feed. */
function LiveSourcePanel({ block, busy, error, defaults, onRefresh, onReconfigure }: CatalogEditorProps & { block: LiveCatalogBlock }) {
  const descriptor = configDescriptorFor(block.kind);
  // Remounted by key whenever the committed config changes, so the form always starts from truth.
  const committed = useMemo(() => descriptor ? initialConfigValues(descriptor, defaults, block) : {}, [block, defaults, descriptor]);
  const [values, setValues] = useState<ConfigValues>(committed);
  const changed = JSON.stringify(values) !== JSON.stringify(committed);
  const missing = descriptor ? missingRequiredField(descriptor, values) : undefined;
  const source = block.kind === "markets" ? `Base ${block.data.base}`
    : block.kind === "news" ? "Top stories"
    : block.kind === "earthquakes" ? "Magnitude 4.5+, past day"
    : block.kind === "games" ? block.config.league
    : "config" in block && block.config && "location" in block.config ? block.config.location.name
    : getLibraryDefinition(block.kind)?.name ?? "Live source";

  return <InspectorSection label="Live source">
    <div className={`catalog-status ${block.stale ? "stale" : ""}`}><span className="status-dot" /><div>
      <strong>{source}</strong>
      <small>{block.stale ? "Saved copy \u00b7 refresh failed" : `Updated ${new Date(block.refreshedAt).toLocaleString()}`}</small>
    </div></div>
    {descriptor && <ConfigFields descriptor={descriptor} values={values} variant="inspector" disabled={busy === "reconfigure"} onChange={setValues} />}
    {descriptor && changed && <button type="button" className="button primary catalog-refresh" disabled={Boolean(busy) || Boolean(missing)} onClick={() => void onReconfigure(values)}>
      {busy === "reconfigure" ? "Fetching\u2026" : missing ? `${missing.label} is needed` : "Apply and fetch"}
    </button>}
    <button type="button" className="button secondary catalog-refresh" disabled={Boolean(busy)} onClick={() => void onRefresh()}>
      <RotateCw size={14} className={busy === "refresh" ? "spinning" : ""} />{busy === "refresh" ? "Refreshing\u2026" : "Refresh data"}
    </button>
    {(error || block.refreshError) && <p className="inspector-inline-error">{error ?? block.refreshError}</p>}
  </InspectorSection>;
}

function CatalogBlockEditor(props: CatalogEditorProps) {
  const { block, onChange } = props;

  if (isLiveCatalogBlock(block)) return <LiveSourcePanel key={`${block.id}:${JSON.stringify("config" in block ? block.config : null)}`} {...props} block={block} />;

  if (block.kind === "agenda") return <>
    <InspectorSection label="Day"><input className="inspector-wide-input" aria-label="Agenda date" value={block.data.date} onChange={(event) => onChange({ ...block, data: { ...block.data, date: event.target.value } })} /></InspectorSection>
    <InspectorSection label="Events"><div className="catalog-structured-list">{block.data.events.map((event, index) => <div className="catalog-row-card" key={event.id}>
      <div className="catalog-time-row"><input aria-label={`Start time ${index + 1}`} value={event.start} onChange={(change) => onChange({ ...block, data: { ...block.data, events: block.data.events.map((item) => item.id === event.id ? { ...item, start: change.target.value } : item) } })} /><input aria-label={`End time ${index + 1}`} placeholder="End" value={event.end ?? ""} onChange={(change) => onChange({ ...block, data: { ...block.data, events: block.data.events.map((item) => item.id === event.id ? { ...item, end: change.target.value || undefined } : item) } })} /></div>
      <input aria-label={`Event title ${index + 1}`} value={event.title} onChange={(change) => onChange({ ...block, data: { ...block.data, events: block.data.events.map((item) => item.id === event.id ? { ...item, title: change.target.value } : item) } })} />
      <div className="catalog-detail-row"><input aria-label={`Event detail ${index + 1}`} placeholder="Location or note" value={event.detail ?? ""} onChange={(change) => onChange({ ...block, data: { ...block.data, events: block.data.events.map((item) => item.id === event.id ? { ...item, detail: change.target.value || undefined } : item) } })} /><button type="button" aria-label={`Remove event ${index + 1}`} onClick={() => onChange({ ...block, data: { ...block.data, events: block.data.events.filter((item) => item.id !== event.id) } })}><Trash2 size={13} /></button></div>
    </div>)}<button type="button" className="add-line" onClick={() => onChange({ ...block, data: { ...block.data, events: [...block.data.events, { id: createId(), start: "9:00", title: "New event" }] } })}><Plus size={14} />Add event</button></div></InspectorSection>
  </>;

  if (block.kind === "habit") return <>
    <InspectorSection label="Heading"><div className="inspector-control-stack"><input className="inspector-wide-input" aria-label="Habit matrix title" value={block.data.title} onChange={(event) => onChange({ ...block, data: { ...block.data, title: event.target.value } })} /><input className="inspector-wide-input" aria-label="Habit matrix period" value={block.data.period} onChange={(event) => onChange({ ...block, data: { ...block.data, period: event.target.value } })} /></div></InspectorSection>
    <InspectorSection label="Habits"><div className="habit-editor">{block.data.rows.map((row, rowIndex) => <div className="habit-editor-row" key={row.id}><div><input aria-label={`Habit ${rowIndex + 1}`} value={row.label} onChange={(event) => onChange({ ...block, data: { ...block.data, rows: block.data.rows.map((item) => item.id === row.id ? { ...item, label: event.target.value } : item) } })} /><button type="button" aria-label={`Remove habit ${rowIndex + 1}`} onClick={() => onChange({ ...block, data: { ...block.data, rows: block.data.rows.filter((item) => item.id !== row.id) } })}><Trash2 size={12} /></button></div><div className="habit-days" aria-label={`${row.label} week`}>{row.values.map((value, dayIndex) => <button type="button" key={dayIndex} aria-label={`${row.label}, day ${dayIndex + 1}: ${value === 2 ? "done" : value === 1 ? "empty" : "skipped"}`} onClick={() => onChange({ ...block, data: { ...block.data, rows: block.data.rows.map((item) => item.id === row.id ? { ...item, values: item.values.map((day, index) => index === dayIndex ? (day === 1 ? 2 : day === 2 ? 0 : 1) as 0 | 1 | 2 : day) } : item) } })}>{value === 2 ? "\u25cf" : value === 1 ? "\u25cb" : "\u00b7"}</button>)}</div></div>)}<button type="button" className="add-line" disabled={block.data.rows.length >= 10} onClick={() => onChange({ ...block, data: { ...block.data, rows: [...block.data.rows, { id: createId(), label: "New habit", values: [1, 1, 1, 1, 1, 1, 1] }] } })}><Plus size={14} />Add habit</button></div></InspectorSection>
  </>;

  if (block.kind === "checklistGroups") {
    const groups = block.data.groups;
    const setGroups = (next: typeof groups) => onChange({ ...block, data: { ...block.data, groups: next } });
    const editGroup = (groupIndex: number, change: (group: typeof groups[number]) => typeof groups[number]) =>
      setGroups(groups.map((group, index) => index === groupIndex ? change(group) : group));
    return <>
      <InspectorSection label="Heading"><div className="inspector-control-stack">
        <input className="inspector-wide-input" aria-label="List title" value={block.data.title} onChange={(event) => onChange({ ...block, data: { ...block.data, title: event.target.value } })} />
        <input className="inspector-wide-input" aria-label="List note" placeholder="Note" value={block.data.note ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, note: event.target.value || undefined } })} />
      </div></InspectorSection>
      <InspectorSection label="Groups"><div className="catalog-structured-list">
        {groups.map((group, groupIndex) => <div className="catalog-row-card" key={groupIndex}>
          <div className="catalog-detail-row">
            <input aria-label={`Group name ${groupIndex + 1}`} value={group.name} onChange={(event) => editGroup(groupIndex, (item) => ({ ...item, name: event.target.value }))} />
            <button type="button" aria-label={`Remove group ${groupIndex + 1}`} disabled={groups.length <= 1} onClick={() => setGroups(groups.filter((_, index) => index !== groupIndex))}><Trash2 size={13} /></button>
          </div>
          {group.items.map((item, itemIndex) => <div className="structured-line" key={itemIndex}>
            <TickBox checked={item.checked} label={`${item.checked ? "Uncheck" : "Check"} ${item.text}`} onChange={() => editGroup(groupIndex, (entry) => ({ ...entry, items: entry.items.map((line, position) => position === itemIndex ? { ...line, checked: !line.checked } : line) }))} />
            <input aria-label={`Item ${itemIndex + 1} in ${group.name}`} value={item.text} onChange={(event) => editGroup(groupIndex, (entry) => ({ ...entry, items: entry.items.map((line, position) => position === itemIndex ? { ...line, text: event.target.value } : line) }))} />
            <button type="button" className="line-remove" aria-label={`Remove item ${itemIndex + 1} in ${group.name}`} disabled={group.items.length <= 1} onClick={() => editGroup(groupIndex, (entry) => ({ ...entry, items: entry.items.filter((_, position) => position !== itemIndex) }))}><Trash2 size={13} /></button>
          </div>)}
          <button type="button" className="add-line" disabled={group.items.length >= 20} onClick={() => editGroup(groupIndex, (entry) => ({ ...entry, items: [...entry.items, { text: "New item", checked: false }] }))}><Plus size={14} />Add item</button>
        </div>)}
        <button type="button" className="add-line" disabled={groups.length >= 6} onClick={() => setGroups([...groups, { name: "New group", items: [{ text: "New item", checked: false }] }])}><Plus size={14} />Add group</button>
      </div></InspectorSection>
    </>;
  }

  if (block.kind === "countdown") {
    const milestones = block.data.milestones;
    const setMilestones = (next: typeof milestones) => onChange({ ...block, data: { ...block.data, milestones: next } });
    return <>
      <InspectorSection label="Event"><div className="inspector-control-stack">
        <input className="inspector-wide-input" aria-label="Countdown event" value={block.data.event} onChange={(event) => onChange({ ...block, data: { ...block.data, event: event.target.value } })} />
        <input className="inspector-wide-input" aria-label="Countdown date" value={block.data.date} onChange={(event) => onChange({ ...block, data: { ...block.data, date: event.target.value } })} />
        <label className="inspector-control-row"><span>Days</span><input type="number" min={0} value={block.data.days} onChange={(event) => onChange({ ...block, data: { ...block.data, days: Math.max(0, Math.round(Number(event.target.value) || 0)) } })} /></label>
        <label className="inspector-control-row"><span>Eyebrow</span><input value={block.data.label} onChange={(event) => onChange({ ...block, data: { ...block.data, label: event.target.value } })} /></label>
      </div></InspectorSection>
      <LineList label="Milestones" addLabel="Add milestone" canAdd={milestones.length < 5} onAdd={() => setMilestones([...milestones, { label: "Next", complete: false }])}>
        {milestones.map((milestone, index) => <div className="structured-line" key={index}>
          <TickBox checked={milestone.complete} label={`${milestone.complete ? "Unmark" : "Mark"} ${milestone.label}`} onChange={() => setMilestones(milestones.map((item, position) => position === index ? { ...item, complete: !item.complete } : item))} />
          <input aria-label={`Milestone ${index + 1}`} maxLength={20} value={milestone.label} onChange={(event) => setMilestones(milestones.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} />
          <button type="button" className="line-remove" aria-label={`Remove milestone ${index + 1}`} disabled={milestones.length <= 1} onClick={() => setMilestones(milestones.filter((_, position) => position !== index))}><Trash2 size={13} /></button>
        </div>)}
      </LineList>
    </>;
  }

  if (block.kind === "mealPlan") {
    const meals = block.data.meals;
    const editMeal = (mealId: string, change: (meal: typeof meals[number]) => typeof meals[number]) =>
      onChange({ ...block, data: { ...block.data, meals: meals.map((meal) => meal.id === mealId ? change(meal) : meal) } });
    return <>
      <InspectorSection label="Meals"><div className="catalog-structured-list">
        {meals.map((meal) => <div className="catalog-row-card" key={meal.id}>
          <div className="catalog-detail-row">
            <input aria-label={`Meal name ${meal.name}`} value={meal.name} onChange={(event) => editMeal(meal.id, (item) => ({ ...item, name: event.target.value }))} />
            <button type="button" aria-label={`Remove ${meal.name}`} disabled={meals.length <= 1} onClick={() => onChange({ ...block, data: { ...block.data, meals: meals.filter((item) => item.id !== meal.id) } })}><Trash2 size={13} /></button>
          </div>
          {meal.dishes.map((dish, index) => <div className="structured-line" key={dish.id}>
            <input aria-label={`Dish ${index + 1} for ${meal.name}`} value={dish.text} onChange={(event) => editMeal(meal.id, (item) => ({ ...item, dishes: item.dishes.map((entry) => entry.id === dish.id ? { ...entry, text: event.target.value } : entry) }))} />
            <button type="button" className="line-remove" aria-label={`Remove dish ${index + 1} from ${meal.name}`} onClick={() => editMeal(meal.id, (item) => ({ ...item, dishes: item.dishes.filter((entry) => entry.id !== dish.id) }))}><Trash2 size={13} /></button>
          </div>)}
          <button type="button" className="add-line" disabled={meal.dishes.length >= 6} onClick={() => editMeal(meal.id, (item) => ({ ...item, dishes: [...item.dishes, { id: createId(), text: "New dish" }] }))}><Plus size={14} />Add dish</button>
        </div>)}
        <button type="button" className="add-line" disabled={meals.length >= 5} onClick={() => onChange({ ...block, data: { ...block.data, meals: [...meals, { id: createId(), name: "New meal", dishes: [] }] } })}><Plus size={14} />Add meal</button>
      </div></InspectorSection>
      <LineList label="Prep before the day" addLabel="Add prep step" canAdd={block.data.prep.length < 6} onAdd={() => onChange({ ...block, data: { ...block.data, prep: [...block.data.prep, { id: createId(), text: "Prep", checked: false }] } })}>
        {block.data.prep.map((item, index) => <div className="structured-line" key={item.id}>
          <TickBox checked={item.checked} label={`${item.checked ? "Uncheck" : "Check"} ${item.text}`} onChange={() => onChange({ ...block, data: { ...block.data, prep: block.data.prep.map((entry) => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry) } })} />
          <input aria-label={`Prep step ${index + 1}`} maxLength={30} value={item.text} onChange={(event) => onChange({ ...block, data: { ...block.data, prep: block.data.prep.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry) } })} />
          <button type="button" className="line-remove" aria-label={`Remove prep step ${index + 1}`} onClick={() => onChange({ ...block, data: { ...block.data, prep: block.data.prep.filter((entry) => entry.id !== item.id) } })}><Trash2 size={13} /></button>
        </div>)}
      </LineList>
    </>;
  }

  if (block.kind === "meetingNotes") {
    const { decisions, actions } = block.data;
    return <>
      <InspectorSection label="Meeting"><div className="inspector-control-stack">
        <input className="inspector-wide-input" aria-label="Meeting topic" placeholder="Topic" value={block.data.topic ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, topic: event.target.value || undefined } })} />
        <input className="inspector-wide-input" aria-label="Attendees" placeholder="With" value={block.data.attendees ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, attendees: event.target.value || undefined } })} />
      </div></InspectorSection>
      <LineList label="Decisions" addLabel="Add decision" canAdd={decisions.length < 8} onAdd={() => onChange({ ...block, data: { ...block.data, decisions: [...decisions, { id: createId(), text: "New decision" }] } })}>
        {decisions.map((decision, index) => <div className="structured-line" key={decision.id}>
          <input aria-label={`Decision ${index + 1}`} value={decision.text} onChange={(event) => onChange({ ...block, data: { ...block.data, decisions: decisions.map((entry) => entry.id === decision.id ? { ...entry, text: event.target.value } : entry) } })} />
          <button type="button" className="line-remove" aria-label={`Remove decision ${index + 1}`} onClick={() => onChange({ ...block, data: { ...block.data, decisions: decisions.filter((entry) => entry.id !== decision.id) } })}><Trash2 size={13} /></button>
        </div>)}
      </LineList>
      <InspectorSection label="Actions"><div className="catalog-structured-list">
        {actions.map((action, index) => {
          const edit = (change: Partial<typeof action>) => onChange({ ...block, data: { ...block.data, actions: actions.map((entry) => entry.id === action.id ? { ...entry, ...change } : entry) } });
          return <div className="catalog-row-card" key={action.id}>
            <div className="structured-line">
              <TickBox checked={action.done} label={`${action.done ? "Reopen" : "Complete"} ${action.text}`} onChange={() => edit({ done: !action.done })} />
              <input aria-label={`Action ${index + 1}`} value={action.text} onChange={(event) => edit({ text: event.target.value })} />
              <button type="button" className="line-remove" aria-label={`Remove action ${index + 1}`} onClick={() => onChange({ ...block, data: { ...block.data, actions: actions.filter((entry) => entry.id !== action.id) } })}><Trash2 size={13} /></button>
            </div>
            <div className="catalog-time-row">
              <input aria-label={`Owner of action ${index + 1}`} placeholder="Owner" value={action.owner ?? ""} onChange={(event) => edit({ owner: event.target.value || undefined })} />
              <input aria-label={`Due date for action ${index + 1}`} placeholder="Due" value={action.due ?? ""} onChange={(event) => edit({ due: event.target.value || undefined })} />
            </div>
          </div>;
        })}
        <button type="button" className="add-line" disabled={actions.length >= 8} onClick={() => onChange({ ...block, data: { ...block.data, actions: [...actions, { id: createId(), text: "New action", done: false }] } })}><Plus size={14} />Add action</button>
      </div></InspectorSection>
    </>;
  }

  if (block.kind === "workoutLog") {
    const exercises = block.data.exercises;
    const edit = (id: string, change: Partial<typeof exercises[number]>) =>
      onChange({ ...block, data: { ...block.data, exercises: exercises.map((entry) => entry.id === id ? { ...entry, ...change } : entry) } });
    return <>
      <InspectorSection label="Session"><div className="inspector-control-stack">
        <input className="inspector-wide-input" aria-label="Workout focus" placeholder="Focus" value={block.data.focus ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, focus: event.target.value || undefined } })} />
        <input className="inspector-wide-input" aria-label="Workout duration" placeholder="Time" value={block.data.duration ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, duration: event.target.value || undefined } })} />
      </div></InspectorSection>
      <InspectorSection label="Exercises"><div className="catalog-structured-list">
        {exercises.map((exercise, index) => <div className="catalog-row-card" key={exercise.id}>
          <div className="catalog-detail-row">
            <input aria-label={`Exercise ${index + 1}`} value={exercise.name} onChange={(event) => edit(exercise.id, { name: event.target.value })} />
            <button type="button" aria-label={`Remove exercise ${index + 1}`} onClick={() => onChange({ ...block, data: { ...block.data, exercises: exercises.filter((entry) => entry.id !== exercise.id) } })}><Trash2 size={13} /></button>
          </div>
          <div className="catalog-triple-row">
            <input aria-label={`Sets for ${exercise.name}`} placeholder="Sets" value={exercise.sets ?? ""} onChange={(event) => edit(exercise.id, { sets: event.target.value || undefined })} />
            <input aria-label={`Reps for ${exercise.name}`} placeholder="Reps" value={exercise.reps ?? ""} onChange={(event) => edit(exercise.id, { reps: event.target.value || undefined })} />
            <input aria-label={`Load for ${exercise.name}`} placeholder="Load" value={exercise.load ?? ""} onChange={(event) => edit(exercise.id, { load: event.target.value || undefined })} />
          </div>
        </div>)}
        <button type="button" className="add-line" disabled={exercises.length >= 12} onClick={() => onChange({ ...block, data: { ...block.data, exercises: [...exercises, { id: createId(), name: "New exercise" }] } })}><Plus size={14} />Add exercise</button>
      </div></InspectorSection>
    </>;
  }

  // What is left are the blank forms — ruled paper to write on, so only the labels are editable.
  const fields = block.kind === "dailyPlan"
    ? ([["Title", "title"], ["Date", "dateLabel"], ["Priorities", "prioritiesLabel"], ["Schedule", "scheduleLabel"], ["Notes", "rememberLabel"]] as const)
    : ([["Date", "dateLabel"]] as const);
  const data = block.data as Record<string, string | undefined>;
  return <InspectorSection label="Labels">
    <div className="inspector-control-stack">{fields.map(([label, key]) => <label className="inspector-control-row" key={key}><span>{label}</span><input value={data[key] ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, [key]: event.target.value } } as CatalogReceiptBlock)} /></label>)}</div>
    <p className="catalog-form-note">A blank form. It prints ruled and empty, ready to fill in by hand.</p>
  </InspectorSection>;
}

export function Inspector({ block, canRemove, mode, favoriteIds, paperWidth, catalogBusy, catalogError, page, settings, bridgeOnline, printStatus, webMcpAvailable, onModeChange, onChange, onRemove, onBrowseLibrary, onInsertFavorite, onRefreshCatalog, onReconfigureCatalog, onPageChange, onSettingsChange }: Props) {
  if (mode === "library") return <aside className="inspector"><InspectorTabs mode={mode} onChange={onModeChange} /><BlocksShelf favoriteIds={favoriteIds} paperWidth={paperWidth} onBrowseLibrary={onBrowseLibrary} onInsertFavorite={onInsertFavorite} /></aside>;
  if (mode === "print") return <aside className="inspector"><InspectorTabs mode={mode} onChange={onModeChange} /><PrintPanel page={page} settings={settings} bridgeOnline={bridgeOnline} printStatus={printStatus} webMcpAvailable={webMcpAvailable} onPageChange={onPageChange} onSettingsChange={onSettingsChange} /></aside>;
  if (!block) return <aside className="inspector"><InspectorTabs mode={mode} onChange={onModeChange} /><div className="inspector-empty"><span>Nothing selected</span><p>Choose a block on the receipt to adjust it.</p></div></aside>;
  return <aside className="inspector">
    <InspectorTabs mode={mode} onChange={onModeChange} />
    <div className="inspector-heading"><h2>{blockName(block)}</h2><button className="icon-button danger" type="button" disabled={!canRemove} onClick={onRemove} aria-label={`Remove ${blockName(block)} block`} title="Remove block"><Trash2 size={16} /></button></div>

    {(block.type === "heading" || block.type === "text") && <TextStyleControls block={block} onChange={onChange} />}

    {block.type === "checklist" && <InspectorSection label="Items"><div className="structured-editor">
      {block.items.map((item, index) => <div className="structured-line" key={item.id}><button type="button" className={`check-button ${item.checked ? "checked" : ""}`} aria-label={`${item.checked ? "Uncheck" : "Check"} item ${index + 1}`} aria-pressed={item.checked} onClick={() => onChange({ ...block, items: block.items.map((value) => value.id === item.id ? { ...value, checked: !value.checked } : value) })}>{item.checked && <Check size={13} />}</button><input aria-label={`Checklist item ${index + 1}`} value={item.text} onChange={(event) => onChange({ ...block, items: block.items.map((value) => value.id === item.id ? { ...value, text: event.target.value } : value) })} /><button type="button" className="line-remove" aria-label={`Remove item ${index + 1}`} onClick={() => onChange({ ...block, items: block.items.filter((value) => value.id !== item.id) })}><Trash2 size={13} /></button></div>)}
      <button type="button" className="add-line" onClick={() => onChange({ ...block, items: [...block.items, { id: createId(), text: "New item", checked: false }] })}><Plus size={14} />Add item</button>
    </div></InspectorSection>}

    {block.type === "keyValue" && <><InspectorSection label="Rows"><div className="structured-editor">
      {block.rows.map((row, index) => <div className="row-card" key={row.id}><div className="two-inputs"><input aria-label={`Label for row ${index + 1}`} value={row.label} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, label: event.target.value } : value) })} /><input aria-label={`Value for row ${index + 1}`} value={row.value} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, value: event.target.value } : value) })} /></div><div className="row-actions"><label><input type="checkbox" aria-label={`Emphasize row ${index + 1}`} checked={row.emphasis} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, emphasis: event.target.checked } : value) })} />Emphasize</label><button type="button" aria-label={`Remove row ${index + 1}`} onClick={() => onChange({ ...block, rows: block.rows.filter((value) => value.id !== row.id) })}><Trash2 size={13} /></button></div></div>)}
      <button type="button" className="add-line" onClick={() => onChange({ ...block, rows: [...block.rows, { id: createId(), label: "Label", value: "Value", emphasis: false }] })}><Plus size={14} />Add row</button>
    </div></InspectorSection><InspectorSection label="Options"><label className="toggle-line"><input type="checkbox" checked={block.dividers} onChange={(event) => onChange({ ...block, dividers: event.target.checked })} /><span>Show row dividers</span></label></InspectorSection></>}

    {block.type === "table" && <><InspectorSection label="Table"><div className="inspector-control-stack"><label className="inspector-control-row"><span>Columns</span><select value={block.columns} onChange={(event) => { const columns = Number(event.target.value) as 2 | 3; onChange({ ...block, columns, rows: block.rows.map((row) => ({ ...row, cells: columns === 3 ? [...row.cells, ""].slice(0, 3) : row.cells.slice(0, 2) })) }); }}><option value={2}>Two</option><option value={3}>Three</option></select></label><label className="toggle-line"><input type="checkbox" checked={block.header} onChange={(event) => onChange({ ...block, header: event.target.checked })} /><span>Header row</span></label></div></InspectorSection><InspectorSection label="Rows"><div className="structured-editor">
      {block.rows.map((row) => <div className="structured-line table-line" key={row.id}>{row.cells.slice(0, block.columns).map((cell, cellIndex) => <input aria-label={`Cell ${cellIndex + 1}`} key={cellIndex} value={cell} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, cells: value.cells.map((value, index) => index === cellIndex ? event.target.value : value) } : value) })} />)}<button type="button" className="line-remove" aria-label="Remove row" onClick={() => onChange({ ...block, rows: block.rows.filter((value) => value.id !== row.id) })}><Trash2 size={13} /></button></div>)}
      <button type="button" className="add-line" onClick={() => onChange({ ...block, rows: [...block.rows, { id: createId(), cells: Array.from({ length: block.columns }, () => "Value") }] })}><Plus size={14} />Add row</button>
    </div></InspectorSection></>}

    {block.type === "divider" && <InspectorSection label="Rule"><label className="inspector-control-row"><span>Style</span><select value={block.style} onChange={(event) => onChange({ ...block, style: event.target.value as typeof block.style })}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label></InspectorSection>}
    {block.type === "catalog" && <CatalogBlockEditor
      block={block}
      busy={catalogBusy?.id === block.id ? catalogBusy.kind : undefined}
      error={catalogError?.id === block.id ? catalogError.message : undefined}
      defaults={{ location: settings.defaultLocation, unit: settings.defaultUnit }}
      onChange={onChange}
      onRefresh={() => onRefreshCatalog(block.id)}
      onReconfigure={(values) => onReconfigureCatalog(block.id, values)}
    />}
  </aside>;
}
