import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ReceiptBlock, RenderedReceipt } from "../receipt";

type Props = {
  rendered: RenderedReceipt;
  blocks: ReceiptBlock[];
  selectedId?: string;
  onSelect(id: string): void;
  onReplace(block: ReceiptBlock): void;
  onMove(id: string, toIndex: number): void;
};

function textMetrics(block: Extract<ReceiptBlock, { type: "heading" | "text" }>) {
  if (block.type === "heading") {
    if (block.level === "display") return { size: 36, lineHeight: 42, weight: 790 };
    if (block.level === "section") return { size: 21, lineHeight: 27, weight: 720 };
    return { size: 28, lineHeight: 34, weight: 740 };
  }
  const sizes = { small: [16, 22], body: [20, 27], large: [24, 32] } as const;
  const [size, lineHeight] = sizes[block.size];
  return { size, lineHeight, weight: block.weight === "bold" ? 720 : block.weight === "medium" ? 590 : 440 };
}

export function ReceiptCanvas({ rendered, blocks, selectedId, onSelect, onReplace, onMove }: Props) {
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = paper.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / rendered.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rendered.width]);

  return <div className="receipt-shell">
    <div className="receipt-paper" ref={paper} style={{ aspectRatio: `${rendered.width} / ${rendered.height}` }}>
      <div className="receipt-svg" dangerouslySetInnerHTML={{ __html: rendered.svg }} />
      <div className="receipt-hit-layer">
        {rendered.blocks.map((geometry, targetIndex) => {
          const block = blocks.find((candidate) => candidate.id === geometry.id);
          if (!block) return null;
          const selected = selectedId === block.id;
          const position: CSSProperties = { left: geometry.x * scale, top: geometry.y * scale, width: geometry.width * scale, height: Math.max(geometry.height * scale, 22) };
          if (selected && (block.type === "heading" || block.type === "text")) {
            const metrics = textMetrics(block);
            return <textarea
              key={block.id}
              className={`receipt-inline align-${block.align}`}
              autoFocus
              aria-label={`Edit ${block.type}`}
              style={{ ...position, fontSize: metrics.size * scale, lineHeight: `${metrics.lineHeight * scale}px`, fontWeight: metrics.weight }}
              value={block.text}
              onChange={(event) => onReplace({ ...block, text: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
            />;
          }
          return <button
            type="button"
            key={block.id}
            className={`receipt-block-hit ${selected ? "selected" : ""}`}
            style={position}
            aria-label={`Select ${block.type} block`}
            draggable
            onClick={() => onSelect(block.id)}
            onDragStart={(event) => event.dataTransfer.setData("text/receipt-block", block.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData("text/receipt-block");
              if (sourceId) onMove(sourceId, targetIndex);
            }}
          />;
        })}
      </div>
    </div>
    <div className="receipt-tear" aria-hidden="true" />
  </div>;
}
