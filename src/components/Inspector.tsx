import { AlignCenter, AlignLeft, AlignRight, Check, Plus, Trash2 } from "lucide-react";
import { createId, type ReceiptBlock } from "../receipt";

type Props = { block?: ReceiptBlock; canRemove: boolean; onChange(block: ReceiptBlock): void; onRemove(): void };

function Alignment({ value, onChange }: { value: "left" | "center" | "right"; onChange(value: "left" | "center" | "right"): void }) {
  return <div className="segmented icon-segmented" aria-label="Alignment">
    {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([align, Icon]) => <button type="button" aria-label={`Align ${align}`} className={value === align ? "active" : ""} key={align} onClick={() => onChange(align)}><Icon size={15} /></button>)}
  </div>;
}

export function Inspector({ block, canRemove, onChange, onRemove }: Props) {
  if (!block) return <aside className="inspector"><div className="inspector-empty"><span>Nothing selected</span><p>Choose a block on the receipt to adjust it.</p></div></aside>;
  return <aside className="inspector">
    <div className="inspector-heading"><div><span>Selected block</span><h2>{block.type === "keyValue" ? "Key / value" : block.type}</h2></div><button className="icon-button danger" type="button" disabled={!canRemove} onClick={onRemove} aria-label="Remove block"><Trash2 size={16} /></button></div>

    {block.type === "heading" && <>
      <label className="field"><span>Text</span><textarea rows={4} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label>
      <label className="field"><span>Level</span><select value={block.level} onChange={(event) => onChange({ ...block, level: event.target.value as typeof block.level })}><option value="display">Display</option><option value="heading">Heading</option><option value="section">Section</option></select></label>
      <Alignment value={block.align} onChange={(align) => onChange({ ...block, align })} />
    </>}

    {block.type === "text" && <>
      <label className="field"><span>Text</span><textarea rows={6} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label>
      <div className="field-pair"><label className="field"><span>Size</span><select value={block.size} onChange={(event) => onChange({ ...block, size: event.target.value as typeof block.size })}><option value="small">Small</option><option value="body">Body</option><option value="large">Large</option></select></label><label className="field"><span>Weight</span><select value={block.weight} onChange={(event) => onChange({ ...block, weight: event.target.value as typeof block.weight })}><option value="regular">Regular</option><option value="medium">Medium</option><option value="bold">Bold</option></select></label></div>
      <Alignment value={block.align} onChange={(align) => onChange({ ...block, align })} />
    </>}

    {block.type === "checklist" && <div className="structured-editor">
      {block.items.map((item) => <div className="structured-line" key={item.id}><button type="button" className={`check-button ${item.checked ? "checked" : ""}`} onClick={() => onChange({ ...block, items: block.items.map((value) => value.id === item.id ? { ...value, checked: !value.checked } : value) })}>{item.checked && <Check size={13} />}</button><input value={item.text} onChange={(event) => onChange({ ...block, items: block.items.map((value) => value.id === item.id ? { ...value, text: event.target.value } : value) })} /><button type="button" className="line-remove" aria-label="Remove item" onClick={() => onChange({ ...block, items: block.items.filter((value) => value.id !== item.id) })}><Trash2 size={13} /></button></div>)}
      <button type="button" className="add-line" onClick={() => onChange({ ...block, items: [...block.items, { id: createId(), text: "New item", checked: false }] })}><Plus size={14} />Add item</button>
    </div>}

    {block.type === "keyValue" && <div className="structured-editor">
      {block.rows.map((row) => <div className="row-card" key={row.id}><div className="two-inputs"><input aria-label="Label" value={row.label} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, label: event.target.value } : value) })} /><input aria-label="Value" value={row.value} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, value: event.target.value } : value) })} /></div><div className="row-actions"><label><input type="checkbox" checked={row.emphasis} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, emphasis: event.target.checked } : value) })} />Emphasize</label><button type="button" aria-label="Remove row" onClick={() => onChange({ ...block, rows: block.rows.filter((value) => value.id !== row.id) })}><Trash2 size={13} /></button></div></div>)}
      <label className="toggle-line"><input type="checkbox" checked={block.dividers} onChange={(event) => onChange({ ...block, dividers: event.target.checked })} /><span>Show row dividers</span></label>
      <button type="button" className="add-line" onClick={() => onChange({ ...block, rows: [...block.rows, { id: createId(), label: "Label", value: "Value", emphasis: false }] })}><Plus size={14} />Add row</button>
    </div>}

    {block.type === "table" && <div className="structured-editor">
      <div className="field-pair"><label className="field"><span>Columns</span><select value={block.columns} onChange={(event) => { const columns = Number(event.target.value) as 2 | 3; onChange({ ...block, columns, rows: block.rows.map((row) => ({ ...row, cells: columns === 3 ? [...row.cells, ""].slice(0, 3) : row.cells.slice(0, 2) })) }); }}><option value={2}>Two</option><option value={3}>Three</option></select></label><label className="toggle-field"><input type="checkbox" checked={block.header} onChange={(event) => onChange({ ...block, header: event.target.checked })} /><span>Header row</span></label></div>
      {block.rows.map((row) => <div className="structured-line table-line" key={row.id}>{row.cells.slice(0, block.columns).map((cell, cellIndex) => <input aria-label={`Cell ${cellIndex + 1}`} key={cellIndex} value={cell} onChange={(event) => onChange({ ...block, rows: block.rows.map((value) => value.id === row.id ? { ...value, cells: value.cells.map((value, index) => index === cellIndex ? event.target.value : value) } : value) })} />)}<button type="button" className="line-remove" aria-label="Remove row" onClick={() => onChange({ ...block, rows: block.rows.filter((value) => value.id !== row.id) })}><Trash2 size={13} /></button></div>)}
      <button type="button" className="add-line" onClick={() => onChange({ ...block, rows: [...block.rows, { id: createId(), cells: Array.from({ length: block.columns }, () => "Value") }] })}><Plus size={14} />Add row</button>
    </div>}

    {block.type === "divider" && <label className="field"><span>Rule style</span><select value={block.style} onChange={(event) => onChange({ ...block, style: event.target.value as typeof block.style })}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label>}
  </aside>;
}
