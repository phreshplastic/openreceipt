# Pete’s Printer

Pete’s Printer is a local-first receipt canvas shared by a human, browser agents, and a thermal printer. The React app edits one block-based receipt directly; WebMCP tools call the same revision-checked receipt interface; a local Python bridge stores immutable raster jobs and delivers them to an Epson TM-L90.

## What ships in v1

- A landing page, three-step local setup, and receipt-first editor.
- Heading, text, checklist, key/value, table, and divider blocks.
- Exact SVG preview and monochrome PNG rasterization from the same document state.
- Blank and checklist templates without a template-management system.
- Five WebMCP tools for reading, editing, templating, previewing, and requesting print.
- Confirm-each-print, approved-template, and autonomous-agent policies; confirmation is the default.
- A localhost FastAPI bridge with SQLite jobs, checksum/idempotency protection, dummy output, and Epson TM-L90 USB delivery.

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

## WebMCP

The app registers `get_receipt`, `apply_receipt_operations`, `load_receipt_template`, `preview_receipt`, and `request_receipt_print` only while `/app` is visible. WebMCP is progressive enhancement: browsers without `document.modelContext` keep the full human interface.

Pete’s Printer is available under the [MIT License](LICENSE).
