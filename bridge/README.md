# Pete's Printer bridge

The bridge serves the compiled web app on localhost and is the canonical local application for the active receipt, settings, durable events, approvals, and immutable print jobs. It sends validated monochrome PNG artifacts to an Epson TM-L90 and refuses non-loopback bind addresses.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
PETES_PRINTER_TRANSPORT=dummy petes-printer --web-dist ../dist
```

Dummy mode writes ESC/POS bytes under the platform application-data directory. USB mode uses Epson vendor/product IDs `04b8:0202`, interface `0`, OUT endpoint `01`, and IN endpoint `82`. Local absolute paths and credentials are never stored in the repository.

Generate a least-privilege headless token without starting the network server:

```bash
petes-printer --create-token codex --scope receipt:read --scope events:read --scope print:request --scope print:status
```

The command writes the plaintext secret to a mode-`0600` file under the bridge data directory and prints its path. Only its SHA-256 hash is stored in SQLite. Use `--list-tokens` and `--revoke-token ID` to manage access.
