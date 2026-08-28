# Pete's Printer bridge

The bridge serves the compiled web app on localhost, stores immutable print jobs in SQLite, and sends monochrome PNG artifacts to an Epson TM-L90. It binds to `127.0.0.1` by default.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
PETES_PRINTER_TRANSPORT=dummy petes-printer --web-dist ../dist
```

Dummy mode writes ESC/POS bytes under the platform application-data directory. USB mode uses Epson vendor/product IDs `04b8:0202`, interface `0`, OUT endpoint `01`, and IN endpoint `82`. Local absolute paths and credentials are never stored in the repository.
