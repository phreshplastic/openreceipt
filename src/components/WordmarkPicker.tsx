import { Check } from "lucide-react";
import { useMemo } from "react";
import { renderPrototypeBlock } from "../blocks/render";
import { suggestWordmark, wordmarkStyles, type LogoData, type WordmarkStyleId } from "../blocks/wordmarks";
import type { PaperWidthDots } from "../blocks/types";
import { PaperSurface } from "./PaperSurface";

/** One mark, drawn on paper at the width it will actually print at. */
function WordmarkPaper({ data, width }: { data: LogoData; width: PaperWidthDots }) {
  const rendered = useMemo(() => renderPrototypeBlock("logo", data, width), [data, width]);
  return <PaperSurface className="wordmark-paper" style={{ aspectRatio: `${rendered.width} / ${rendered.height}` }} dangerouslySetInnerHTML={{ __html: rendered.svg }} />;
}

type Props = {
  selected: WordmarkStyleId;
  /** Shown as-is when the person has written their own lines; otherwise each mark speaks for itself. */
  data?: LogoData;
  firstName: string;
  width?: PaperWidthDots;
  onSelect(style: WordmarkStyleId): void;
};

export function WordmarkPicker({ selected, data, firstName, width = 576, onSelect }: Props) {
  return <div className="wordmark-grid" role="radiogroup" aria-label="Printer wordmark">
    {wordmarkStyles.map((style) => {
      const suggestion = suggestWordmark(style.id, firstName);
      // The chosen mark previews the person's own words; the rest preview their own suggestion,
      // so the menu never shows six copies of one line of text. This is a style picker, not a
      // size picker, so every card previews at the same size regardless of what is actually
      // stored on the block — otherwise the six cards would not sit level with each other.
      const preview: LogoData = {
        ...(data && style.id === selected ? data : { style: style.id, primary: suggestion.primary, secondary: suggestion.secondary }),
        size: "medium",
      };
      const isSelected = style.id === selected;
      return <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        className={`wordmark-card ${isSelected ? "selected" : ""}`}
        key={style.id}
        onClick={() => onSelect(style.id)}
      >
        <WordmarkPaper data={preview} width={width} />
        <span className="wordmark-copy"><strong>{style.name}</strong><small>{style.description}</small></span>
        <span className="wordmark-tick" aria-hidden="true">{isSelected && <Check size={13} />}</span>
      </button>;
    })}
  </div>;
}
