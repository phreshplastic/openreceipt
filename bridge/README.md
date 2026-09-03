# OpenReceipt bridge

The bridge is the local runtime for OpenReceipt. It serves the compiled app on loopback, stores
the active receipt and print jobs in SQLite, handles approval state, and sends validated monochrome
PNG artifacts to the tested Epson TM-L90 over USB.

It refuses non-loopback bind addresses because v1 has no remote-access authentication. Run it on
the laptop or Raspberry Pi that is physically connected to the printer.

## Install and run

From the repository root:

~~~bash
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e './bridge[dev]'
npm run build
petes-printer --web-dist ./dist
~~~

The app is available at `http://127.0.0.1:8731`. Set `PETES_PRINTER_TRANSPORT=dummy` to write
ESC/POS bytes to a local file instead of opening USB.

The shipped USB adapter expects Epson vendor/product ID `04b8:0202`, interface `0`, OUT endpoint
`01`, and IN endpoint `82`. Linux users may need a udev rule for unprivileged USB access; the
[python-escpos installation guide](https://github.com/python-escpos/python-escpos/blob/master/doc/user/installation.rst)
describes the pattern.

## Headless MCP

Build the headless server from the repository root:

~~~bash
npm run build:mcp
~~~

Create a least-privilege token without starting the bridge server:

~~~bash
petes-printer --create-token mcp \
  --scope receipt:read --scope receipt:write \
  --scope events:read --scope print:request --scope print:status
~~~

The command writes the one-time secret to a mode-0600 file under the bridge data directory and
stores only its SHA-256 hash in SQLite. Use `--list-tokens` to inspect token IDs and
`--revoke-token ID` to revoke one.

For a stdio MCP host, point it at `dist-mcp/server.mjs` and set:

~~~json
{
  "mcpServers": {
    "openreceipt": {
      "command": "node",
      "args": ["/absolute/path/to/openreceipt/dist-mcp/server.mjs"],
      "env": {
        "PETES_PRINTER_URL": "http://127.0.0.1:8731",
        "PETES_PRINTER_TOKEN": "pp_..."
      }
    }
  }
}
~~~

The headless server uses the same receipt and tool definitions as the browser. Printing remains
revision-bound and may wait for approval in the local editor.

## Raspberry Pi

The Pi uses the same source install and bridge command as a laptop. Install Node.js 22+, Python
3.12+, and `libusb-1.0-0`, apply a udev rule for the confirmed Epson USB ID, build the app, and
leave `petes-printer --web-dist ./dist` running beside the printer. The editor can run in a browser
on the Pi, and an agent running on the Pi can use the headless MCP server over loopback. Drafting
and previewing work without a browser; the default print policy still requires local approval.

If a laptop needs to operate the Pi-hosted editor, tunnel the loopback port:

~~~bash
ssh -N -L 8731:127.0.0.1:8731 pi@raspberrypi.local
~~~

Do not bind the bridge to a LAN address or expose it through a public URL.
