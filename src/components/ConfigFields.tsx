import { Plus, Trash2 } from "lucide-react";
import type { ConfigDescriptor, ConfigValues } from "../block-library";

/** One form, rendered from the descriptor, so the library modal and the Inspector cannot drift. */
export function ConfigFields({ descriptor, values, disabled, variant, onChange }: {
  descriptor: ConfigDescriptor;
  values: ConfigValues;
  disabled?: boolean;
  variant: "modal" | "inspector";
  onChange(values: ConfigValues): void;
}) {
  const set = (name: string, value: ConfigValues[string]) => onChange({ ...values, [name]: value });
  const inputClass = variant === "inspector" ? "inspector-wide-input" : undefined;

  return <div className={variant === "modal" ? "library-config" : "config-fields"}>
    {descriptor.fields.map((field) => {
      const id = `config-${descriptor.kind}-${field.name}`;
      if (field.type === "list") {
        const entries = Array.isArray(values[field.name]) ? values[field.name] as string[] : [];
        return <div className="config-list" key={field.name}>
          <span>{field.label}</span>
          <div className="structured-editor">
            {entries.map((entry, index) => <div className="structured-line" key={index}>
              <input aria-label={`${field.itemLabel} ${index + 1}`} value={entry} disabled={disabled}
                onChange={(event) => set(field.name, entries.map((value, position) => position === index ? event.target.value : value))} />
              <button type="button" className="line-remove" aria-label={`Remove ${field.itemLabel.toLowerCase()} ${index + 1}`}
                disabled={disabled || entries.length <= field.min}
                onClick={() => set(field.name, entries.filter((_, position) => position !== index))}><Trash2 size={13} /></button>
            </div>)}
            <button type="button" className="add-line" disabled={disabled || entries.length >= field.max}
              onClick={() => set(field.name, [...entries, `${field.itemLabel} ${entries.length + 1}`])}><Plus size={14} />Add {field.itemLabel.toLowerCase()}</button>
          </div>
        </div>;
      }
      return <label key={field.name} htmlFor={id}>
        <span>{field.label}</span>
        {field.type === "select"
          ? <select id={id} value={String(values[field.name] ?? "")} disabled={disabled} onChange={(event) => set(field.name, event.target.value)}>
              {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          : <input id={id} className={inputClass} type={field.type === "number" ? "number" : "text"}
              placeholder={field.type === "text" ? field.placeholder : undefined}
              min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined}
              maxLength={field.type === "text" ? field.maxLength : undefined}
              value={String(values[field.name] ?? "")} disabled={disabled}
              onChange={(event) => set(field.name, field.type === "number" ? Math.max(0, Math.round(Number(event.target.value) || 0)) : event.target.value)} />}
      </label>;
    })}
    {descriptor.summary && <small>{descriptor.summary}</small>}
  </div>;
}
