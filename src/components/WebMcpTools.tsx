import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { webMcpReadToolCount, webMcpToolCatalog, webMcpWriteToolCount } from "../agent/tool-catalog";

type Props = { registered: boolean };

export function WebMcpTools({ registered }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return <div className="webmcp-tools" ref={root}>
    <button
      type="button"
      className={`rail-template-button rail-footer-button webmcp-tools-button ${open ? "is-open" : ""}`}
      aria-label={`WebMCP tools, ${webMcpToolCatalog.length} tools`}
      aria-expanded={open}
      aria-controls="webmcp-tools-panel"
      onClick={() => setOpen((current) => !current)}
    >
      <Sparkles size={15} />
      <span>WebMCP tools</span>
      <span className="webmcp-tools-count" aria-hidden="true">{webMcpToolCatalog.length}</span>
    </button>

    {open && <section
      className="webmcp-tools-panel"
      id="webmcp-tools-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="webmcp-tools-title"
    >
      <header>
        <div>
          <span className="webmcp-tools-mark">WebMCP</span>
          <h2 id="webmcp-tools-title">Tools an agent can call</h2>
        </div>
        <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close WebMCP tools"><X size={15} /></button>
      </header>
      <p>This page registers {webMcpToolCatalog.length} tools. A compatible agent drafts and edits the same receipt you see. Printing waits for you.</p>
      <p className="webmcp-tools-status">
        <span className={`status-dot ${registered ? "online" : ""}`} />
        <span>{registered
          ? `Registered for this page · ${webMcpReadToolCount} read, ${webMcpWriteToolCount} write`
          : "No WebMCP host in this browser · editing works as usual"}</span>
      </p>
      <ol>
        {webMcpToolCatalog.map((tool) => <li key={tool.name}>
          <div>
            <code>{tool.name}</code>
            <span className="webmcp-tools-kind">{tool.readOnly ? "Read" : "Write"}</span>
          </div>
          <span>{tool.copy}</span>
        </li>)}
      </ol>
    </section>}
  </div>;
}
