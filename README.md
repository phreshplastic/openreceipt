# Pete’s Printer

Pete’s Printer is a local-first receipt canvas shared by a human, browser agents, headless clients, and a thermal printer. SQLite owns the active receipt, settings, approvals, events, and immutable print jobs; the React app is an optimistic client, and WebMCP uses that same revision-checked receipt session.

## What ships in v1

- A landing page, three-step local setup, and receipt-first editor.
- Heading, text, checklist, key/value, table, and divider blocks.
- Exact SVG preview and monochrome PNG rasterization from the same document state.
- Blank and checklist templates without a template-management system.
- Seven WebMCP tools for reading, drafting reminders, editing, browsing blocks, templating, previewing, and requesting print.
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

The canonical endpoints are `/api/v1/receipt`, `/api/v1/settings`, `/api/v1/events`, and `/api/v1/print-requests`. Settings remain browser-session-only. Grant `print:approve` separately when a future MCP host should be able to submit a decision after chat confirmation; `print:direct` is reserved for the compatibility print-job route.

## WebMCP

The app registers `get_receipt`, `list_block_catalog`, `draft_reminder`, `apply_receipt_operations`, `load_receipt_template`, `preview_receipt`, and `request_receipt_print` only while `/app` is visible. Every mutation and print request is revision-bound; printing uses an immutable snapshot, and editing during approval invalidates the request. WebMCP is progressive enhancement, so browsers without `document.modelContext` keep the full human interface.

A future Base API or conventional MCP server should be a thin adapter over this local HTTP interface. Headless rasterization and those adapters remain deliberately deferred, so they won’t create a second editing model or bypass the local print policy.

Pete’s Printer is available under the [MIT License](LICENSE).
