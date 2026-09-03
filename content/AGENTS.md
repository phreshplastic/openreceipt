# OpenReceipt

OpenReceipt is a local-first receipt editor for people, AI agents, and an Epson TM-L90 thermal printer. The browser and agent tools edit the same revision-checked receipt, and physical printing stays behind an explicit local approval policy.

These instructions apply only when editing files under `content/`. For application, bridge, or test work, use the repository-level `AGENTS.md` instead.

## Installation

OpenReceipt currently runs from source. Install Node.js 22 or newer and Python 3.12 or newer, then run:

```bash
npm install
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e 'bridge[dev]'
npm run build
petes-printer --web-dist ./dist
```

Open `http://127.0.0.1:8731`. The bridge binds to loopback and does not expose the printer to the public network.

## Configuration

The shipped adapter is physically tested with an Epson TM-L90 over native USB. It currently expects vendor/product IDs `04b8:0202`, interface `0`, OUT endpoint `01`, and IN endpoint `82`.

Choose either the 80 mm / 576-dot profile or the 58 mm / 420-dot profile during setup. Use `PETES_PRINTER_TRANSPORT=dummy` to render ESC/POS output to a local file without touching hardware.

## Agent usage

Browser agents use WebMCP. Headless clients use the conventional MCP server built with `npm run build:mcp`. The useful first calls are:

1. `get_app_status` to confirm the editor and printer are ready.
2. `list_receipt_recipes` or `list_receipt_blocks` to choose a receipt shape.
3. `draft_receipt` or `edit_receipt` to make the paper. Give the receipt a distinctive title — that name is the drafts list, not the heading on the paper. Use `rename_receipt` to change it later. Use `setCopy` on `edit_receipt` to change heading or text wording without replacing the block. `save_receipt_template` keeps the current receipt as a named starting point; `load_receipt_template` brings one back.
4. `preview_receipt` to inspect the exact dimensions and text.
5. `request_receipt_print` to create a revision-bound print request.

Printing is consequential. Keep confirmation enabled unless the person operating the printer has deliberately chosen a narrower trusted automation policy.
