# OpenReceipt

OpenReceipt turns useful lists, reminders, and briefs into thermal receipts. People and agents share revision-checked drafts; a local bridge stores receipts, templates, and print jobs beside the printer. Agents can update a shopping list without printing, show its preview, and print when requested. Trusted credentials can also print automatically under the owner's policy.

This is an **experimental, self-hosted project**. The verified physical setup is an Epson TM-L90 USB interface (`04b8:0202`) with an 80 mm roll, on macOS and an ARM64 Raspberry Pi running Docker. Both 80 mm and 58 mm layouts render; physical 58 mm printing, other interface boards, and other printers are unverified. See [verification and remaining checks](deploy/VERIFICATION.md).

The source and plugin are reusable. Each owner runs their own bridge and keeps their own receipts, credentials, and optional OpenAI tunnel private. There is no shared print service or maintainer tunnel to connect to. The project uses the [MIT license](LICENSE); bundled font licenses live in `src/assets/fonts`.

## Choose your setup

| Goal | Start here |
| --- | --- |
| Try the editor without a printer | Run the laptop setup below in dummy mode. |
| Print at your desk | Run the same bridge with the TM-L90 attached over USB. |
| Leave printing ready on a Pi | Follow the [Docker and private networking guide](deploy/README.md). |
| Use Codex with your printer | Follow the [OpenReceipt plugin setup](plugins/openreceipt/README.md). |
| Use ChatGPT with your Pi | Run the optional tunnel wizard after the Docker setup. |

## First run on a laptop

Install Node.js 24+, Python 3.12+, and libusb for USB printing. On macOS, `brew install libusb` supplies the USB library; on Debian-based Linux, use `sudo apt install libusb-1.0-0`. Clone and build:

```bash
git clone https://github.com/phreshplastic/openreceipt.git
cd openreceipt
npm ci
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e './bridge[dev]'
npm run build:local
PETES_PRINTER_TRANSPORT=dummy petes-printer --data-dir ./bridge/data --web-dist ./dist
```

Open [http://127.0.0.1:8731/app](http://127.0.0.1:8731/app). Choose virtual output to explore the editor and review flow. Dummy output writes `bridge/data/last-print.bin`; it does not print paper. The bridge starts its Node renderer automatically.

For physical printing, stop that process, connect the powered TM-L90, then restart without the dummy override:

```bash
petes-printer --data-dir ./bridge/data --web-dist ./dist
```

Choose Epson USB in setup and the width of the loaded roll, then test and print a short receipt. Linux USB access needs the [narrow udev rule](deploy/99-openreceipt.rules); use the Docker guide for the exact installation commands. `petes-printer --diagnose` distinguishes a stopped bridge from missing USB, permission, or occupied-interface problems. A hosted browser page cannot discover a Pi's USB device: use the editor served by that Pi.

## Always-on Raspberry Pi

Use a 64-bit Linux Pi with Docker Compose, Python 3 for the setup helper, and a powered TM-L90. Clone the repository **on the Pi**, copy `.env.example` to `.env`, configure USB permissions, and start the stack as described in [deploy/README.md](deploy/README.md):

```bash
cp .env.example .env
docker compose up -d --build --wait
docker compose ps
```

One worker owns USB access. Unsent jobs wait through disconnects and survive restarts; an interrupted transmission becomes unknown and requires a paper check before reprinting. The owner can pause the queue and cancel unsent jobs. Receipts, templates, and history stay in SQLite on a persistent volume. Physical reconnect recovery still needs the checks listed in the verification notes.

Ports bind to host loopback. Use your own Tailscale installation or an SSH forward for private access. The owner editor trusts that private network boundary; MCP clients additionally need scoped credentials. [Backup, restore, upgrade, and rollback](deploy/README.md#backup-restore-upgrade-rollback) are documented. This stack does not install or change Home Assistant.

## Connect agents

The [plugin guide](plugins/openreceipt/README.md) covers creating a scoped credential, copying its private file, configuring the client, installing `openreceipt@openreceipt`, and checking status and previews without printing. Default credentials require review. Automatic printing requires both an explicit `print:automatic` credential and the owner's compatible bridge policy.

For ChatGPT, run this from the laptop checkout after the Pi stack is healthy:

```bash
bash scripts/setup-chatgpt-tunnel.sh
```

The wizard asks for **your** SSH host and directories, installs the official checksum-verified tunnel client and wrapper, creates a dedicated bridge credential, guides your own OpenAI account/workspace linking, captures the runtime key privately, and installs a supervised service. Choose Tunnel and No authentication in ChatGPT because the private wrapper supplies the bridge credential. This package does not implement OAuth discovery or a public Plugins Directory listing. See the [tunnel guide](deploy/README.md#chatgpt-through-secure-mcp-tunnel) for prerequisites and troubleshooting.

Ask an agent to find or create a named shopping list, add items without printing, preview it, then print once. Saved lists have their own `receiptId` and revision, so updating one need not replace another receipt open in the editor. Reuse a stable print `requestId` for a retry; check the existing job instead of submitting a new copy. Previews return a smooth image and an editable receipt link. Screen and paper layouts use the same SVG and bundled fonts, with a native monochrome raster for printing.

Codex's installed connection and ChatGPT's personal tunnel have been exercised; a separate interactive Codex chat remains a manual check. Other platforms receive standard MCP configuration without tested compatibility claims. Agents provide scheduling and content intelligence; OpenReceipt owns storage, rendering, permissions, and the queue.

## Browser demo and development

The browser also exposes WebMCP tools. The [public site](https://openreceipt.phreshplastic.com) is a browser demo; its editor does not run your Pi installation. The public build makes demo previews without contacting a local bridge. Open the private bridge-hosted editor for physical printing:

```bash
npm run dev
PETES_PRINTER_PUBLIC_URL=https://your-domain.example npm run build:public
node scripts/serve-public.mjs
```

The development server uses the local bridge at port 8731. `npm run build:mcp` builds the headless server and canonical renderer. Focused verification:

```bash
npm run lint
npm run build:mcp
npm test
bridge/.venv/bin/python -m pytest bridge/tests
python3 scripts/tests/test_setup_host.py
node --test scripts/tests/*.test.mjs
bash -n scripts/setup-chatgpt-tunnel.sh
```

MCP integration tests require the bridge virtual environment and temporary loopback servers. Browser checks use Playwright; set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome. See [SECURITY.md](SECURITY.md) for the private access boundary and vulnerability reports.
