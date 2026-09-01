import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import type { ReceiptBlock } from "../receipt";

type TextBlock = Extract<ReceiptBlock, { type: "heading" | "text" }>;

type Props = {
  block?: ReceiptBlock;
  onChange(block: ReceiptBlock): void;
};

export function MobileFormatBar({ block, onChange }: Props) {
  if (!block || (block.type !== "heading" && block.type !== "text")) return null;
  const textBlock: TextBlock = block;

  return <div className="mobile-format-bar" role="toolbar" aria-label="Mobile text formatting">
    <select
      aria-label="Text preset"
      value={textBlock.type === "heading" ? textBlock.level : textBlock.size}
      onChange={(event) => onChange(textBlock.type === "heading"
        ? { ...textBlock, level: event.target.value as typeof textBlock.level }
        : { ...textBlock, size: event.target.value as typeof textBlock.size })}
    >
      {textBlock.type === "heading" ? <>
        <option value="display">Display</option>
        <option value="heading">Heading</option>
        <option value="section">Section</option>
      </> : <>
        <option value="small">Small</option>
        <option value="body">Body</option>
        <option value="large">Large</option>
      </>}
    </select>
    <span className="mobile-format-divider" aria-hidden="true" />
    <button type="button" aria-label="Bold" aria-pressed={textBlock.weight === "bold"} className={textBlock.weight === "bold" ? "active" : ""} onClick={() => onChange({ ...textBlock, weight: textBlock.weight === "bold" ? "regular" : "bold" })}><Bold size={18} /></button>
    <button type="button" aria-label="Italic" aria-pressed={textBlock.italic} className={textBlock.italic ? "active" : ""} onClick={() => onChange({ ...textBlock, italic: !textBlock.italic })}><Italic size={18} /></button>
    <button type="button" aria-label="Underline" aria-pressed={textBlock.underline} className={textBlock.underline ? "active" : ""} onClick={() => onChange({ ...textBlock, underline: !textBlock.underline })}><Underline size={18} /></button>
    <span className="mobile-format-divider" aria-hidden="true" />
    {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([alignment, Icon]) => <button type="button" key={alignment} aria-label={`Align ${alignment}`} aria-pressed={textBlock.align === alignment} className={textBlock.align === alignment ? "active" : ""} onClick={() => onChange({ ...textBlock, align: alignment })}><Icon size={18} /></button>)}
  </div>;
}
