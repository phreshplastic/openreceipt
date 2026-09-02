import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Blocks, ChevronDown, GripVertical, MousePointer2, Plus } from "lucide-react";
import type { EditorActivity } from "../App";
import { isAgentWorking } from "../agent/captions";
import type { CoreReceiptBlock, ReceiptBlock, RenderedReceipt } from "../receipt";
import { PaperSurface } from "./PaperSurface";

type Props = {
  rendered: RenderedReceipt;
  blocks: ReceiptBlock[];
  selectedId?: string;
  recentAgentBlockIds?: string[];
  agentActivity?: EditorActivity;
  onUndo?(): void;
  onSelect(id: string): void;
  onReplace(block: ReceiptBlock): void;
  onMove(id: string, toIndex: number): void;
  onAdd(type: CoreReceiptBlock["type"], index: number): void;
  onBrowseCatalog(index: number): void;
  onOpenAddMenu?(): void;
};

const blockOptions: { type: CoreReceiptBlock["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "checklist", label: "Checklist" },
  { type: "keyValue", label: "Key / value" },
  { type: "table", label: "Table" },
  { type: "divider", label: "Divider" },
];

function textMetrics(block: Extract<ReceiptBlock, { type: "heading" | "text" }>) {
  if (block.type === "heading") {
    const baseWeight = block.level === "display" ? 790 : block.level === "section" ? 720 : 740;
    const weight = block.weight === "bold" ? baseWeight : block.weight === "medium" ? 590 : 440;
    if (block.level === "display") return { size: 36, lineHeight: 42, weight };
    if (block.level === "section") return { size: 21, lineHeight: 27, weight };
    return { size: 28, lineHeight: 34, weight };
  }
  const sizes = { small: [16, 22], body: [20, 27], large: [24, 32] } as const;
  const [size, lineHeight] = sizes[block.size];
  return { size, lineHeight, weight: block.weight === "bold" ? 720 : block.weight === "medium" ? 590 : 440 };
}

type MenuState = { index: number; left: number; top: number; placement: "up" | "down" };

const ReceiptInk = memo(function ReceiptInk({ svg }: { svg: string }) {
  return <div className="receipt-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
});

export function ReceiptCanvas({ rendered, blocks, selectedId, recentAgentBlockIds = [], agentActivity, onAdd, onBrowseCatalog, onOpenAddMenu, onSelect, onReplace, onMove, onUndo }: Props) {
  const paper = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [menu, setMenu] = useState<MenuState>();
  const [draggingId, setDraggingId] = useState<string>();
  const [dragOverIndex, setDragOverIndex] = useState<number>();

  useLayoutEffect(() => {
    const element = paper.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / rendered.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rendered.width]);

  useEffect(() => {
    if (!menu) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenu(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(undefined); };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  const openMenu = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 196;
    const placement = rect.bottom + 280 > window.innerHeight ? "up" : "down";
    setMenu({
      index,
      left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)),
      top: placement === "up" ? rect.top - 7 : rect.bottom + 7,
      placement,
    });
    onOpenAddMenu?.();
  };

  const moveAt = useCallback((sourceId: string | undefined, insertIndex: number) => {
    if (!sourceId) return;
    const sourceIndex = blocks.findIndex((block) => block.id === sourceId);
    if (sourceIndex < 0) return;
    const toIndex = Math.max(0, Math.min(blocks.length - 1, sourceIndex < insertIndex ? insertIndex - 1 : insertIndex));
    onMove(sourceId, toIndex);
    setDragOverIndex(undefined);
    setDraggingId(undefined);
  }, [blocks, onMove]);

  const insertionY = useCallback((index: number) => {
    const previous = rendered.blocks[index - 1];
    const next = rendered.blocks[index];
    if (index === 0) return Math.max(8, (next?.y ?? 16) * scale - 8);
    if (index === blocks.length) return Math.min(rendered.height * scale - 10, ((previous?.y ?? 0) + (previous?.height ?? 0)) * scale + 8);
    return (((previous.y + previous.height) + next.y) / 2) * scale;
  }, [blocks.length, rendered.blocks, rendered.height, scale]);

  useEffect(() => {
    if (!draggingId) return;
    const nearestInsertion = (clientY: number) => {
      const paperRect = paper.current?.getBoundingClientRect();
      if (!paperRect) return 0;
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index <= blocks.length; index += 1) {
        const distance = Math.abs(clientY - (paperRect.top + insertionY(index)));
        if (distance < nearestDistance) { nearest = index; nearestDistance = distance; }
      }
      return nearest;
    };
    const over = (event: globalThis.DragEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".canvas-stage")) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      setDragOverIndex(nearestInsertion(event.clientY));
    };
    const drop = (event: globalThis.DragEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".canvas-stage")) return;
      event.preventDefault();
      const sourceId = event.dataTransfer?.getData("text/receipt-block") || draggingId;
      moveAt(sourceId, nearestInsertion(event.clientY));
    };
    document.addEventListener("dragover", over);
    document.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("dragover", over);
      document.removeEventListener("drop", drop);
    };
  }, [blocks.length, draggingId, insertionY, moveAt]);

  const selectedGeometry = rendered.blocks.find((geometry) => geometry.id === selectedId);
  const composing = agentActivity?.phase === "drafting";
  const agentGeometry = !composing && agentActivity
    ? rendered.blocks.find((geometry) => agentActivity.blockIds.includes(geometry.id)) ?? rendered.blocks[0]
    : undefined;
  const agentCursorStyle: CSSProperties | undefined = agentGeometry ? {
    transform: `translate3d(${Math.min(rendered.width * scale - 18, (agentGeometry.x + agentGeometry.width) * scale + 8)}px, ${Math.max(8, (agentGeometry.y + Math.min(agentGeometry.height, 22)) * scale)}px, 0)`,
  } : undefined;
  const working = agentActivity ? isAgentWorking(agentActivity.phase) : false;

  return <div className={`receipt-shell ${draggingId ? "is-reordering" : ""}`}>
    <div className="receipt-stage" ref={paper}>
      <PaperSurface className="receipt-paper" style={{ aspectRatio: `${rendered.width} / ${rendered.height}` }}>
        <ReceiptInk svg={rendered.svg} />
      </PaperSurface>
      <div className="receipt-hit-layer">
        {rendered.blocks.map((geometry) => {
          const block = blocks.find((candidate) => candidate.id === geometry.id);
          if (!block) return null;
          const selected = selectedId === block.id;
          const agentChanged = recentAgentBlockIds.includes(block.id);
          const position: CSSProperties = { left: geometry.x * scale, top: geometry.y * scale, width: geometry.width * scale, height: Math.max(geometry.height * scale, 22) };
          if (selected && (block.type === "heading" || block.type === "text")) {
            const metrics = textMetrics(block);
            const editorPosition = { ...position, height: (geometry.height + metrics.lineHeight - metrics.size) * scale };
            return <Fragment key={block.id}>
              <span className={`receipt-selection-frame ${agentChanged ? "agent-changed" : ""}`} style={position} aria-hidden="true" />
              <textarea
                data-receipt-block-id={block.id}
                className={`receipt-inline align-${block.align}`}
                autoFocus
                aria-label={`Edit ${block.type}`}
                style={{ ...editorPosition, fontSize: metrics.size * scale, lineHeight: `${metrics.lineHeight * scale}px`, fontWeight: metrics.weight, fontStyle: block.italic ? "italic" : "normal", textDecoration: block.underline ? "underline" : "none" }}
                value={block.text}
                onChange={(event) => onReplace({ ...block, text: event.target.value })}
                onPointerDown={(event) => event.stopPropagation()}
              />
            </Fragment>;
          }
          return <button
            type="button"
            key={block.id}
            className={`receipt-block-hit ${selected ? "selected" : ""} ${agentChanged ? "agent-changed" : ""}`}
            style={position}
            aria-label={`Select ${block.type === "catalog" ? block.kind : block.type} block`}
            data-receipt-block-id={block.id}
            onClick={() => onSelect(block.id)}
          />;
        })}
      </div>
      {composing && agentActivity && <div className="agent-composing" aria-hidden="true">
        <div className="agent-composing-card">
          <span className="agent-working"><i /><i /><i /></span>
          <span>{agentActivity.message}</span>
        </div>
      </div>}
    </div>

    <div className="receipt-chrome-layer">
      {agentActivity && agentCursorStyle && <div className={`agent-cursor phase-${agentActivity.phase}`} style={agentCursorStyle}>
        <MousePointer2 size={18} fill="currentColor" />
        <div className="agent-cursor-card">
          <span className="agent-cursor-who">Agent{working && <span className="agent-working"><i /><i /><i /></span>}</span>
          <span className="agent-cursor-caption">{agentActivity.message}</span>
          {agentActivity.phase === "complete" && onUndo && <button type="button" onClick={(event) => { event.stopPropagation(); onUndo(); }}>Undo</button>}
        </div>
      </div>}
      {selectedGeometry && <button
        type="button"
        draggable
        className="block-drag-grip"
        style={{ top: (selectedGeometry.y + selectedGeometry.height / 2) * scale }}
        aria-label="Drag selected block"
        title="Drag to reorder"
        onDragStart={(event) => {
          if (!selectedId) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/receipt-block", selectedId);
          setDraggingId(selectedId);
        }}
        onDragEnd={() => { setDraggingId(undefined); setDragOverIndex(undefined); }}
      ><GripVertical size={14} /></button>}

      {Array.from({ length: blocks.length + 1 }, (_, index) => {
        const previous = rendered.blocks[index - 1];
        const next = rendered.blocks[index];
        const edge = index === 0 || index === blocks.length;
        if (edge && !draggingId) return null;
        const y = insertionY(index);
        const naturalStart = previous ? (previous.y + previous.height) * scale : y - 12;
        const naturalEnd = next ? next.y * scale : y + 12;
        const zoneHeight = edge ? 24 : Math.max(1, naturalEnd - naturalStart);
        const zoneTop = edge ? y - zoneHeight / 2 : naturalStart;
        const insertionStyle = {
          top: zoneTop,
          height: zoneHeight,
          "--insertion-line-y": `${y - zoneTop}px`,
        } as CSSProperties;
        return <div
          className={`receipt-insertion-point ${dragOverIndex === index ? "active" : ""} ${edge ? "edge" : ""}`}
          style={insertionStyle}
          key={index}
          onDragEnter={() => setDragOverIndex(index)}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverIndex(index); }}
          onDrop={(event) => { event.preventDefault(); moveAt(event.dataTransfer.getData("text/receipt-block") || draggingId, index); }}
        >
          <span className="receipt-insertion-line" />
          <button type="button" aria-label={`Insert block at position ${index + 1}`} onClick={(event) => openMenu(event, index)}><Plus size={11} /></button>
        </div>;
      })}
    </div>

    <div className="receipt-add-control">
      <button
        type="button"
        className="button secondary receipt-add-button"
        aria-expanded={menu?.index === blocks.length}
        aria-haspopup="menu"
        onClick={(event) => menu?.index === blocks.length ? setMenu(undefined) : openMenu(event, blocks.length)}
      >
        <Plus size={15} />
        <span>Add block</span>
        <ChevronDown size={13} />
      </button>
    </div>

    {menu && createPortal(<div
      className={`add-menu receipt-floating-add-menu placement-${menu.placement}`}
      ref={menuRef}
      role="menu"
      aria-label="Add block"
      style={{ position: "fixed", left: menu.left, top: menu.top, transform: menu.placement === "up" ? "translateY(-100%)" : undefined }}
    >
      {blockOptions.map((option) => <button type="button" role="menuitem" key={option.type} onClick={() => { onAdd(option.type, menu.index); setMenu(undefined); }}>{option.label}</button>)}
      <span className="add-menu-separator" />
      <button type="button" role="menuitem" className="browse-library-item" onClick={() => { onBrowseCatalog(menu.index); setMenu(undefined); }}><Blocks size={13} />Browse all blocks…</button>
    </div>, document.body)}
  </div>;
}
