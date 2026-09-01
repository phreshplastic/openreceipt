/**
 * A local stand-in for the browser's WebMCP host.
 *
 * Chrome only exposes `modelContext` behind the origin trial or
 * chrome://flags/#enable-webmcp-testing. This installs a minimal host so the same tool
 * registrations can be driven from any browser, and adds a panel for calling them by hand.
 * It is a development and testing aid — never install it over a real host.
 */

type ShimTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown, context?: { signal?: AbortSignal }): unknown | Promise<unknown>;
};

export type WebMcpShim = {
  tools: Map<string, ShimTool>;
  call(name: string, input?: unknown): Promise<unknown>;
};

declare global {
  interface Window { __webmcpShim?: WebMcpShim }
}

export function shimRequested(search = typeof location === "undefined" ? "" : location.search) {
  const flag = new URLSearchParams(search).get("webmcp");
  if (flag === "shim") return true;
  if (flag === "off") return false;
  return import.meta.env.DEV;
}

export function installWebMcpShim(): WebMcpShim | undefined {
  if (typeof document === "undefined") return undefined;
  if ((document as Document & { modelContext?: unknown }).modelContext) return undefined;
  if (window.__webmcpShim) return window.__webmcpShim;

  const tools = new Map<string, ShimTool>();
  const listeners = new Set<() => void>();

  const modelContext = {
    registerTool(tool: ShimTool, options?: { signal?: AbortSignal }) {
      tools.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => { tools.delete(tool.name); listeners.forEach((listener) => listener()); }, { once: true });
      listeners.forEach((listener) => listener());
    },
    getTools: async () => [...tools.values()],
    async executeTool(tool: ShimTool, input: unknown) { return tools.get(tool.name)?.execute(input); },
    addEventListener(type: string, listener: () => void) { if (type === "toolchange") listeners.add(listener); },
    removeEventListener(_type: string, listener: () => void) { listeners.delete(listener); },
  };

  Object.defineProperty(document, "modelContext", { configurable: true, value: modelContext });

  const shim: WebMcpShim = {
    tools,
    async call(name, input) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`No tool named ${name}. Registered: ${[...tools.keys()].join(", ")}`);
      return tool.execute(input ?? {});
    },
  };
  window.__webmcpShim = shim;
  mountPanel(tools, listeners);
  return shim;
}

function mountPanel(tools: Map<string, ShimTool>, listeners: Set<() => void>) {
  const host = document.createElement("div");
  host.id = "webmcp-shim";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .launcher, .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; font: 12px/1.45 Inter, system-ui, sans-serif; color: #111; }
      .launcher { padding: 7px 12px; border: 1px solid #d4d4d8; border-radius: 999px; background: #fff; box-shadow: 0 6px 18px rgb(0 0 0 / .12); cursor: pointer; }
      .panel { width: 360px; max-height: 74vh; display: none; flex-direction: column; background: #fff; border: 1px solid #d4d4d8; border-radius: 12px; box-shadow: 0 14px 40px rgb(0 0 0 / .18); overflow: hidden; }
      .panel[data-open="true"] { display: flex; }
      header { display: flex; align-items: baseline; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #ececf0; }
      header h1 { margin: 0; font-size: 13px; font-weight: 600; }
      header p { margin: 0; color: #71717a; font-size: 11px; }
      header button { margin-left: auto; border: 0; background: none; font-size: 15px; line-height: 1; cursor: pointer; color: #71717a; }
      .body { padding: 12px 14px; overflow: auto; display: grid; gap: 8px; }
      select, textarea { width: 100%; box-sizing: border-box; font: inherit; border: 1px solid #d4d4d8; border-radius: 7px; padding: 7px 8px; background: #fff; }
      textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; min-height: 76px; resize: vertical; }
      .run { border: 0; border-radius: 7px; padding: 8px 12px; background: #111; color: #fff; font: inherit; font-weight: 500; cursor: pointer; justify-self: start; }
      .run:disabled { opacity: .55; cursor: progress; }
      .hint { color: #71717a; }
      pre { margin: 0; padding: 9px 10px; background: #f4f4f5; border-radius: 7px; white-space: pre-wrap; word-break: break-word; max-height: 30vh; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    </style>
    <button class="launcher" type="button">Agent tools</button>
    <section class="panel" data-open="false">
      <header><h1>WebMCP shim</h1><p>Local host, dev only</p><button class="close" type="button" aria-label="Close">×</button></header>
      <div class="body">
        <select class="tool"></select>
        <p class="hint"></p>
        <textarea class="input" spellcheck="false">{}</textarea>
        <button class="run" type="button">Run tool</button>
        <pre class="result">Pick a tool and run it.</pre>
      </div>
    </section>`;
  document.body.append(host);

  const launcher = root.querySelector<HTMLButtonElement>(".launcher")!;
  const panel = root.querySelector<HTMLElement>(".panel")!;
  const select = root.querySelector<HTMLSelectElement>(".tool")!;
  const hint = root.querySelector<HTMLParagraphElement>(".hint")!;
  const input = root.querySelector<HTMLTextAreaElement>(".input")!;
  const run = root.querySelector<HTMLButtonElement>(".run")!;
  const result = root.querySelector<HTMLPreElement>(".result")!;

  const setOpen = (open: boolean) => {
    panel.dataset.open = String(open);
    launcher.style.display = open ? "none" : "block";
  };
  launcher.addEventListener("click", () => setOpen(true));
  root.querySelector<HTMLButtonElement>(".close")!.addEventListener("click", () => setOpen(false));

  const describe = () => {
    const tool = tools.get(select.value);
    hint.textContent = tool ? tool.description : "No tools registered yet.";
    const properties = tool?.inputSchema?.properties as Record<string, unknown> | undefined;
    if (properties && Object.keys(properties).length) hint.textContent += `  Fields: ${Object.keys(properties).join(", ")}.`;
  };

  const refresh = () => {
    const previous = select.value;
    select.replaceChildren(...[...tools.keys()].map((name) => new Option(name, name)));
    if (tools.has(previous)) select.value = previous;
    describe();
  };
  listeners.add(refresh);
  select.addEventListener("change", describe);
  refresh();

  run.addEventListener("click", async () => {
    const tool = tools.get(select.value);
    if (!tool) return;
    run.disabled = true;
    result.textContent = "Running…";
    try {
      const parsed = JSON.parse(input.value.trim() || "{}");
      const output = await tool.execute(parsed) as { content?: Array<{ text?: string }>; structuredContent?: unknown };
      const text = output?.content?.[0]?.text ?? "";
      result.textContent = `${text}\n\n${JSON.stringify(output?.structuredContent ?? output, null, 2)}`.trim();
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      run.disabled = false;
    }
  });
}
