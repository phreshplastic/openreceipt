# Pete’s Printer

Pete’s Printer is a local-first receipt canvas shared by a human, browser agents, headless clients, and a thermal printer. SQLite owns the active receipt, settings, approvals, events, and immutable print jobs; the React app is an optimistic client, and WebMCP uses that same revision-checked receipt session.

## What ships in v1

- A landing page, three-step local setup, and receipt-first editor.
- Heading, text, checklist, key/value, table, and divider blocks, plus grouped lists, countdowns, agendas, habit grids, live weather, air quality, markets, news, and seven blank write-in forms.
- Exact SVG preview and monochrome PNG rasterization from the same document state.
- Blank and checklist templates without a template-management system.
- Ten agent tools — situations, vocabulary, one-shot drafting, positional and item-level editing, a plain-text print preview, undo, and permission-gated printing — served identically over WebMCP in the browser and over conventional MCP headlessly.
- Confirm-each-print, approved-template, and autonomous-agent policies; confirmation is the default.
- A loopback-only FastAPI application with revision conflicts, scoped tokens, durable events, server-side approvals, checksum/idempotency protection, dummy output, and Epson TM-L90 USB delivery.

Accounts, cloud sync, routines, schedules, remote bridges, images, and QR codes are intentionally outside this release.

## Development

Node.js 22+ and Python 3.12+ are required.

```bash
npm install
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e 'bridge[dev]'
```

Run the bridge in dummy mode, then start Vite in a second terminal:

```bash
PETES_PRINTER_TRANSPORT=dummy petes-printer --data-dir ./bridge/data
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Dummy prints write ESC/POS bytes to `bridge/data/last-print.bin`.

The temporary [block playground](http://127.0.0.1:5173/blocks) presents receipt-native prototypes at 80 mm and 58 mm. Its linked [thermal chart lab](http://127.0.0.1:5173/blocks/charts) compares the five shared chart primitives at both paper widths. These are isolated design-review surfaces: choosing a prototype there does not modify the receipt schema or saved document.

## Production-style local run

```bash
npm run build
petes-printer --web-dist ./dist
```

Open [http://127.0.0.1:8731](http://127.0.0.1:8731). The bridge binds to localhost by default and stores configuration, artifacts, and `printer.sqlite3` in the platform application-data directory. Set `PETES_PRINTER_TRANSPORT=dummy` to avoid touching USB hardware.

The TM-L90 adapter uses Epson USB IDs `04b8:0202`, interface `0`, OUT endpoint `01`, and IN endpoint `82`. Linux installations need ordinary libusb/udev access for the unprivileged bridge process.

## Checks

```bash
npm run check
npm run test:e2e
bridge/.venv/bin/pytest bridge/tests
```

The receipt module is the shared test surface for human and agent mutations. The bridge treats a failure before transmission as `failed`; once sending begins, an uncertain result becomes `unknown` and is never retried automatically.

## Local API and headless tokens

The browser starts a same-origin HttpOnly session and sends a CSRF token for state changes. Headless clients use narrowly scoped bearer tokens; token secrets are written once to owner-readable files, while SQLite stores only their hashes.

```bash
petes-printer --create-token codex \
  --scope receipt:read --scope receipt:write --scope events:read \
  --scope print:request --scope print:status
petes-printer --list-tokens
petes-printer --revoke-token TOKEN_ID
```

The canonical endpoints are `/api/v1/receipt`, `/api/v1/settings`, `/api/v1/events`, and `/api/v1/print-requests`. Settings remain browser-session-only. Grant `print:approve` separately when an MCP host should be able to submit a decision after confirming in chat rather than in the browser; `print:direct` is reserved for the compatibility print-job route.

## Agents

The same ten tools are registered in the browser through WebMCP and served headlessly through a conventional MCP server. Both bind one definition in `src/agent/tools.ts`, so a tool behaves identically wherever it is called from.

| Tool | What it is for |
| --- | --- |
| `get_app_status` | Editor URL, setup state, printer health, print policy, last print |
| `get_receipt` | Compact outline by default; `detail: text` for a stand-in of the print, `json` for the document |
| `list_receipt_blocks` | The block vocabulary, with when each one earns its place |
| `list_receipt_recipes` | Situations — the blocks a trip or a morning brief wants, and what to ask first |
| `draft_receipt` | Composes a whole receipt in one call from flat, id-free blocks |
| `edit_receipt` | Positional block edits plus item- and row-level changes |
| `preview_receipt` | Dot dimensions, paper length in millimetres, warnings, and the text that will print |
| `undo_agent_edit` | Steps back the last change |
| `request_receipt_print` | Consequential; may wait for an explicit tap of approval |
| `open_receipt_editor` | Brings the visible editor up so a person can look first |

Every mutation and print request is revision-bound: printing uses an immutable snapshot, and any human edit during approval invalidates the request. Tools carry `readOnlyHint`, and anything that can surface third-party feed text carries `untrustedContentHint`.

### How a person talks a receipt into existence

The agent brings the intelligence; the app brings the taste. When someone describes a situation rather than naming blocks, `list_receipt_recipes` returns the blocks that belong on that paper and the details worth confirming first.

| Someone says | What happens |
| --- | --- |
| "I'm flying to Lisbon Thursday, international" | `list_receipt_recipes` → `travel_prep` → confirm the gaps → `draft_receipt`: countdown, flight facts, Lisbon's forecast, packing grouped by carry-on / clothes / before-the-door |
| "print my morning" | `daily_brief` → forecast, agenda, habit grid, one line of news |
| "remind me to call mom at 6" | `reminder` → one `draft_receipt` call |
| "mark the passport as packed" | `edit_receipt` `checkItem` — one item, no block rewrite |
| "how long will that be?" | `preview_receipt` → paper length and overflow warnings |
| "actually, undo that" | `undo_agent_edit` |
| "looks good, print it" | `request_receipt_print` |

### WebMCP in the browser

Tools register on every route against `document.modelContext`, falling back to `navigator.modelContext` for the Chrome 149–156 origin trial while the API finishes migrating. Browsers without either keep the full human interface — WebMCP is progressive enhancement.

To drive the tools without an origin trial, append `?webmcp=shim` (on by default in `npm run dev`). That installs a local host and a panel for calling any tool by hand, and it is what the end-to-end tests drive.

### Headless MCP

`mcp/server.ts` is a thin adapter over the same tools, talking to the bridge over its HTTP API and rendering with the browser's own SVG renderer, so headless output matches the screen. It also serves the verbal cues as MCP prompts (`travel_receipt`, `daily_brief`, `reminder`, `packing_list`, `meeting_notes`, `grocery_run`) and exposes `receipt://current` and `receipt://recipes` as resources.

```bash
npm run build:mcp
petes-printer --create-token mcp \
  --scope receipt:read --scope receipt:write \
  --scope print:request --scope print:status
```

```json
{
  "mcpServers": {
    "petes-printer": {
      "command": "node",
      "args": ["/absolute/path/to/printer-webmcp/dist-mcp/server.mjs"],
      "env": {
        "PETES_PRINTER_URL": "http://127.0.0.1:8731",
        "PETES_PRINTER_TOKEN": "pp_..."
      }
    }
  }
}
```

The handoff needs no new machinery: the server writes to the bridge, and any open editor tab picks the draft up over its existing event stream. Ask it to print and the browser raises its approval panel; the tool returns a job id straight away rather than holding the call open, and `get_print_job_status` reports where the job ended up.

Pete’s Printer is available under the [MIT License](LICENSE).
