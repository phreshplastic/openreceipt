# OpenReceipt

OpenReceipt is a local-first receipt editor for people and AI agents. An agent can draft a useful
receipt, a person can edit the same paper, and an explicit approval sends the result to an Epson
TM-L90 thermal printer.

The browser exposes the receipt through WebMCP, so an agent works with named tools instead of
clicking through the interface. The local bridge keeps the receipt, approval, and print job on the
machine beside the printer. There is no account or cloud print queue in this release.

- [Source code](https://github.com/phreshplastic/openreceipt)
- [MIT License](LICENSE)
- [Printer setup guide](content/guides/epson-tm-l90-ai-printer-setup.md)
- [How agents use OpenReceipt](content/guides/how-ai-agents-print-with-webmcp.md)

## Choose a setup

| You want to… | Use this path |
| --- | --- |
| Try the editor or WebMCP without hardware | Use the public browser build or run the app locally in dummy mode. |
| Print while you are working at your desk | Connect the TM-L90 to your laptop by USB and run the bridge there. |
| Leave the printer ready with the laptop off | Connect the TM-L90 to a Raspberry Pi, run the bridge on the Pi, and use the Pi as the local OpenReceipt host. |

The public site can edit receipts and register WebMCP tools. For physical printing, start the local
bridge on the same laptop as the browser; the live app connects to that loopback bridge. A Raspberry
Pi setup still requires the Pi-hosted app or an SSH tunnel because the live site does not reach across
your network.

## Direct USB setup on a laptop

This is the shortest path and the hardware path tested by the project. You need an Epson TM-L90
with a USB interface, an 80 mm or 58 mm thermal roll, Node.js 22 or newer, Python 3.12 or newer,
and permission for your user account to access the printer.

Clone the repository and install the app and bridge:

~~~bash
git clone https://github.com/phreshplastic/openreceipt.git
cd openreceipt
npm install
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e './bridge[dev]'
npm run build
~~~

Start OpenReceipt with the compiled app:

~~~bash
petes-printer --web-dist ./dist
~~~

Open [http://127.0.0.1:8731](http://127.0.0.1:8731), or open the live app at
`https://openreceipt.phreshplastic.com/app` to use the bridge from the public site. Connect the TM-L90 by USB, and complete the
single setup screen. Choose the detected Epson, choose the width of the roll that is loaded, and
press **Test connection**. When the connection slip looks right, use **Finish setup** from the
setup page or return to the editor and press **Print**.

The tested adapter expects Epson USB vendor/product ID `04b8:0202`, interface `0`, OUT endpoint
`01`, and IN endpoint `82`. Some TM-L90 interface boards report different values, so compare the
printer in front of you if detection fails.

### Try it without a printer

Dummy mode writes printer bytes to a local file instead of touching USB:

~~~bash
PETES_PRINTER_TRANSPORT=dummy petes-printer --data-dir ./bridge/data --web-dist ./dist
~~~

The output appears at `bridge/data/last-print.bin`. Dummy mode checks the editor, renderer, queue,
and approval flow; only a real USB print checks paper feed and cutting.

## Raspberry Pi setup

The Pi can sit beside the TM-L90 and remain powered on while your laptop is off. It runs the same
bridge and the same compiled web app; the printer still connects by USB, and OpenReceipt still
binds to loopback for safety.

Install Node.js 22+, Python 3.12+, and libusb on the Pi, then install the repository:

~~~bash
sudo apt update
sudo apt install libusb-1.0-0
git clone https://github.com/phreshplastic/openreceipt.git
cd openreceipt
npm install
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e './bridge[dev]'
npm run build
~~~

Linux may need a udev rule before an unprivileged bridge can open the printer. Confirm the device
with `lsusb`, then add a rule scoped to the Epson USB ID rather than running OpenReceipt as root:

~~~bash
lsusb
sudoedit /etc/udev/rules.d/99-openreceipt-tm-l90.rules
~~~

Use the confirmed vendor and product IDs in the rule, reload udev, and reconnect the printer. The
[python-escpos USB installation guide](https://github.com/python-escpos/python-escpos/blob/master/doc/user/installation.rst)
explains the Linux permission pattern.

For the tested device, the rule can contain:

~~~text
SUBSYSTEM=="usb", ATTR{idVendor}=="04b8", ATTR{idProduct}=="0202", MODE="0660", GROUP="plugdev"
~~~

Add your account to `plugdev` if needed, reload udev, and reconnect the printer:

~~~bash
sudo usermod -aG plugdev "$USER"
sudo udevadm control --reload-rules
sudo udevadm trigger
~~~

Log out and back in after changing group membership.

Start the bridge on the Pi:

~~~bash
petes-printer --web-dist ./dist
~~~

Open `http://127.0.0.1:8731` in a browser on the Pi to complete setup and run the test print. The
Pi can then keep the local app and printer ready without your laptop.

If you want to operate the Pi-hosted editor from your laptop, create an SSH tunnel. This preserves
the loopback-only bridge instead of exposing it to the network:

~~~bash
ssh -N -L 8731:127.0.0.1:8731 pi@raspberrypi.local
~~~

Then open [http://127.0.0.1:8731](http://127.0.0.1:8731) on the laptop. For an agent that runs on
the Pi without an open browser, build the headless MCP server and connect it to the local bridge.
Drafting and preview work without a browser; the default print policy still requires approval in
the local editor. The bridge-specific token and MCP configuration are in [bridge/README.md](bridge/README.md).

Do not bind the bridge to a LAN address or expose it through a public URL. The v1 bridge has no
remote-access authentication, and its loopback boundary protects receipts, settings, and print
approval.

## Public browser build

The public build is for exploring the editor and WebMCP without installing the bridge. It does not
print because the browser tab has no local USB access.

~~~bash
PETES_PRINTER_PUBLIC_URL=https://your-domain.example npm run build:public
node scripts/serve-public.mjs
~~~

The build pre-renders the landing page and guides, then loads the browser editor and WebMCP tools
progressively. A browser with WebMCP support can call the tools; other browsers still get the human
editor.

## What OpenReceipt provides

- A receipt canvas that people can edit while an agent drafts or updates the same revision-checked document.
- Structured blocks for headings, text, checklists, facts, tables, groups, countdowns, agendas, and write-in forms.
- Exact SVG preview and monochrome PNG rasterization at the selected 80 mm / 576-dot or 58 mm / 420-dot profile.
- Approval-bound printing: an edit made while a print is waiting invalidates that print request.
- A local FastAPI bridge that stores state and sends the approved raster to the tested Epson TM-L90 USB path.
- Dummy output for development and physical USB output for the supported printer setup.

## WebMCP and agents

The browser registers the same core tool definitions used by the headless MCP server. The most
useful tools are:

| Tool | Purpose |
| --- | --- |
| `get_app_status` | Check setup, bridge, printer, and print-policy state. |
| `list_receipt_recipes` | Choose a receipt shape for a situation such as travel or a morning brief. |
| `list_receipt_templates` | See built-in starters and any templates saved from a receipt. |
| `draft_receipt` | Compose a complete receipt from a situation and confirmed details. |
| `edit_receipt` | Change blocks or one checklist, table, agenda, or group item without rewriting siblings. Use `setCopy` to change heading or text wording without resetting style. |
| `rename_receipt` | Set the shelf and editor title without changing the heading printed on paper. |
| `save_receipt_template` | Keep the current receipt as a named template. A matching name updates the saved copy. |
| `load_receipt_template` | Replace the current receipt with a built-in or saved template. |
| `preview_receipt` | Inspect dot dimensions, paper length, text, and warnings before printing. |
| `request_receipt_print` | Submit a revision-bound print request that may wait for human approval. |

See [How agents use OpenReceipt](content/guides/how-ai-agents-print-with-webmcp.md) for the full
tool behavior and examples. Printing stays consequential: the default policy requires a person to
approve it.

## Development

Run the browser app with the local WebMCP shim:

~~~bash
npm run dev
~~~

The development server expects the bridge at `http://127.0.0.1:8731`. For the full local app,
build the project and run `petes-printer --web-dist ./dist` as shown above. Build the headless MCP
server with `npm run build:mcp`; its setup and token options are documented in [bridge/README.md](bridge/README.md).

Focused checks:

~~~bash
npm run lint
npm test
bridge/.venv/bin/pytest bridge/tests
~~~

## Troubleshooting

**The page says the bridge is unavailable.** Start `petes-printer` and open the local URL on the
same machine. A public deployment cannot connect to a laptop or Pi bridge.

**The TM-L90 is not detected.** Check power, the USB cable, and `04b8:0202`. On Linux, confirm
the device with `lsusb` and fix udev permissions instead of running the app as root.

**The receipt is clipped or too narrow.** Select the width that matches the roll and the printer’s
paper guide. The preview uses printer dots, so browser zoom does not change the printed layout.

**The paper prints but does not cut.** Confirm that the TM-L90 has a working cutter and that its
own self-test can activate it.

**A print result is unknown.** Check the paper before printing again. Once transmission starts,
the bridge cannot know whether the printer stopped halfway or finished, so an automatic retry could
produce a duplicate.

## Hardware and license

OpenReceipt currently claims one physical path: an Epson TM-L90 over USB with 80 mm or 58 mm
paper. Other ESC/POS printers may work with additional adapter work, but they are not tested or
advertised as supported.

OpenReceipt is available under the [MIT License](LICENSE). See [SECURITY.md](SECURITY.md) for the
loopback boundary and vulnerability-reporting guidance.
