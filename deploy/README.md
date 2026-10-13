# OpenReceipt on a laptop or Raspberry Pi

The personal installation's completed checks and remaining hardware checks are recorded in [VERIFICATION.md](VERIFICATION.md).

OpenReceipt keeps receipts, templates, printer configuration, and jobs beside the printer. Agents provide the content and scheduling. One worker sends USB jobs in order; unplugging the printer leaves unsent jobs waiting. A transmission interrupted after sending starts is marked unknown and requires a paper check before reprinting.

Browser and MCP previews use the same smooth PNG at twice the paper resolution. Physical printing uses the monochrome raster at the printer's native dot width, from the same SVG layout. Bundled regular, bold, and italic fonts keep rendering consistent across hosts. `node --import tsx scripts/receipt-layout-gallery.mts` produces shopping, reminder, morning-brief, and packing samples at both widths for visual checks.

## Laptop

Install Node 24+ and Python 3.12+, then run from the checkout:

```bash
npm ci
python3 -m venv bridge/.venv
. bridge/.venv/bin/activate
pip install -e './bridge[dev]'
npm run build:local
petes-printer --data-dir ./bridge/data --web-dist ./dist
```

The bridge starts the Node renderer automatically. Open `http://127.0.0.1:8731/app`, choose the Epson and the loaded roll width, then test the connection. Virtual output is a separate explicit choice. The public build stays in demo mode; the Pi-hosted editor uses its own origin for printing.

`petes-printer --diagnose` reports service reachability separately from USB access. On macOS, an agent sandbox can hide a device that macOS detects; the bridge must run in a normal terminal or an authorized process with USB access. `bridge/.venv/bin/python scripts/check-printer.py --count 10` explicitly prints ten short numbered slips and verifies duplicate submissions are suppressed.

## Pi Docker installation

Use a 64-bit Linux Pi with Docker Compose. Connect the tested Epson TM-L90 by USB. Install the narrow udev rule once on the host:

Clone the repository on that host, enter its directory, and copy `.env.example` to `.env` before continuing. Install Python 3 for the host setup helper; Node and the bridge's Python runtime are supplied by Docker. Docker Compose is a prerequisite rather than something the installer changes. Run setup as your ordinary Docker user.

```bash
sudo install -m 644 deploy/99-openreceipt.rules /etc/udev/rules.d/99-openreceipt.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=usb
getent group plugdev
```

Set `OPENRECEIPT_USB_GID` in a private `.env` file to the numeric group ID from that command if it differs from 46. Reconnect the printer after installing the rule.

```bash
docker compose up -d --build --wait
docker compose ps
docker compose logs --tail 50 bridge runtime mcp
```

The editor/API is published only at `127.0.0.1:8731`, and MCP only at `127.0.0.1:8733/mcp`. The renderer stays on the Compose network. USB bus mounting and the device cgroup rule allow reconnects even when Linux gives the printer a new device number. Containers run as UID 10001 with the USB group; they do not require privileged mode. The named data volume survives container replacement.

For a hardware-free check, set `PETES_PRINTER_TRANSPORT=dummy` in `.env` and recreate the bridge. Remove that setting and recreate it before a physical check. A dummy result is not a USB connection.

## Private Tailscale access

Use the Pi's existing Tailscale service. Expose the editor privately with:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:8731
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8733
tailscale serve status
```

Tailscale may require enabling HTTPS for the tailnet once. Set these Compose environment values to the exact URL/host shown by Serve, then recreate the affected services:

```text
PETES_PRINTER_ALLOWED_ORIGINS=https://YOUR-PI.YOUR-TAILNET.ts.net
PETES_PRINTER_EDITOR_URL=https://YOUR-PI.YOUR-TAILNET.ts.net
PETES_PRINTER_MCP_ALLOWED_HOSTS=YOUR-PI.YOUR-TAILNET.ts.net:8443,YOUR-PI.YOUR-TAILNET.ts.net
```

Use Tailscale access rules to restrict this Pi's editor to the owner's devices. MCP additionally requires a scoped bridge bearer token on every HTTP request. Existing LAN addresses and other Docker services are unaffected.

## Agent credentials and printing policy

Create a separate token for each trusted client. Its one-time secret is written into `/data/tokens` and never printed by the command:

```bash
docker compose exec bridge petes-printer --data-dir /data --create-token codex \
  --scope receipt:read --scope receipt:write --scope events:read \
  --scope print:request --scope print:status --scope print:automatic
```

Enable autonomous printing in the editor settings for trusted automatic use. A token without `print:automatic` still waits for review even when the installation is autonomous. Agent tokens do not need `print:direct` or `print:approve`. The owner can pause the entire queue and cancel unsent jobs in the editor.

`--list-tokens` lists IDs without secrets; `--revoke-token ID` prevents subsequent use and cancels that credential's unsent jobs. Copy a token file securely to a client's credential store when setting up that client. Keep it out of repository files and chat messages.

For Codex, follow the [plugin setup](../plugins/openreceipt/README.md). Clone and build the MCP server on the computer running Codex, create a dedicated credential on the printer host, and copy its file securely to that computer. The configurable launcher connects that local MCP process to the private printer host. HTTP-capable clients can connect directly to the private Tailscale MCP endpoint with a bearer credential.

Run `node scripts/configure-plugin.mjs --url https://YOUR-PI.YOUR-TAILNET.ts.net --token-file /absolute/path/to/private/codex.token`, then `node scripts/check-mcp.mjs` to check status and an existing receipt preview without printing. Register the repository marketplace with `codex plugin marketplace add /absolute/path/to/openreceipt`, then install `codex plugin add openreceipt@openreceipt`. New Codex chats load the connection and receipt skill. Avoid duplicate enabled connections; migration from the previous personal marketplace is covered in the plugin README.

## ChatGPT through Secure MCP Tunnel

Use the [official tunnel setup](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). Create a tunnel associated with your personal OpenAI organization and ChatGPT workspace, and store its runtime API key locally rather than in this repository. Run the official `tunnel-client` beside OpenReceipt and configure its MCP stdio command to invoke the Node server through a wrapper that loads a dedicated ChatGPT bridge token.

On the Pi, the wrapper can use `docker compose exec -T -e PETES_PRINTER_TOKEN mcp node dist-mcp/server.mjs`; the host wrapper reads the token from a mode-0600 file and exports it before execution. The child server talks to `http://bridge:8731` inside Compose. The tunnel's remote admin UI stays private. Supervise `tunnel-client run --profile openreceipt` with a service restart policy.

Run `tunnel-client doctor --profile openreceipt --explain`, then add a custom MCP server in ChatGPT using its Tunnel connection option. Keep access limited to the intended account/workspace. This is a private installation; the tunnel is not public plugin directory distribution.

After the Docker stack is healthy, run `bash scripts/setup-chatgpt-tunnel.sh` from the checkout on your laptop. It asks for your host's SSH destination, checkout path, and tunnel data directory. Your SSH account needs Docker access and sudo permission to install its service; password prompts stay in your own terminal.

The wizard calls `scripts/setup-host.py` on that host to download the official Linux ARM64/AMD64 client, verify its published SHA-256 checksum, create a dedicated bridge credential, and install the stdio wrapper. It resolves the latest official release and records the installed version and checksums. Version v0.0.16 was used for the verified installation. To pin it during manual preparation, run `python3 scripts/setup-host.py tunnel --version v0.0.16` on the host.

Create **your own** tunnel and associate it with your ChatGPT workspace/account. The wizard captures the runtime API key with hidden input and sends it over SSH stdin, never in command arguments. The remote helper writes mode-0600 environment files, checks the tunnel profile, and installs `openreceipt-tunnel-USERNAME.service` using the chosen directory rather than assuming a username or home path. It restarts automatically after failures or clean child exits. The wizard's local inputs stay in ignored `bridge/data/tunnel.env`.

In ChatGPT select **Tunnel** and **No authentication**: the private stdio wrapper supplies your dedicated bridge credential. OpenReceipt does not implement OAuth discovery, and the OpenAI runtime key is not an OAuth client secret. Test by listing receipts and previewing one without printing. Grant `print:automatic` during setup only if wanted, and enable autonomous policy in your own editor separately. Account/workspace permissions still determine whether the tunnel appears. This source package does not provide a shared tunnel or a universal Plugins Directory listing.

On the host, inspect `systemctl status "openreceipt-tunnel-$(id -un).service"` and `curl --fail http://127.0.0.1:8736/readyz`. The older `openreceipt-tunnel@USERNAME.service` template remains for compatibility with existing personal installations; new installations use the generated service. Do not run both tunnel processes for the same tunnel ID.

The application works without the OpenAI tunnel. Actual ChatGPT verification requires account linking and credentials; standard MCP configuration alone does not establish it.

## Backup, restore, upgrade, rollback

Create a consistent live backup including the database, raster artifacts, and credentials:

```bash
docker compose exec bridge petes-printer --data-dir /data --backup /data/openreceipt-backup.tar.gz
docker compose cp bridge:/data/openreceipt-backup.tar.gz ./openreceipt-backup.tar.gz
chmod 600 ./openreceipt-backup.tar.gz
```

Schema v5 also makes a SQLite backup before migrating an existing database. Browser shelf import is idempotent and preserves existing server receipts rather than overwriting them from an older browser cache.

Pause the queue before making a backup intended for restoration, then restore the previous pause setting afterward. The backup retains that pause. Before resuming a restored queue, check pending jobs against the paper: a job that was waiting when the snapshot was taken may have printed since then.

To restore, keep the old volume for rollback and create a fresh one:

```bash
docker volume create openreceipt-restored
docker run --rm --user 0:0 -v openreceipt-restored:/data \
  -v "$PWD/openreceipt-backup.tar.gz:/restore.tar.gz:ro" openreceipt-bridge:local \
  sh -c 'petes-printer --data-dir /data --restore /restore.tar.gz && chown -R 10001:10001 /data'
```

The one-time restore container can read the private host backup and gives the new volume to UID 10001; the running services continue to use that unprivileged user. Use a Compose override mapping `/data` to that restored volume, then restart OpenReceipt. Restore refuses to overwrite an existing database and remaps artifact paths for its new host.

Before an upgrade, pause printing, back up, and tag the current `openreceipt-bridge:local` and `openreceipt-runtime:local` images with a rollback version. Build the new checkout and run `docker compose up -d`. To roll back, stop OpenReceipt, set `OPENRECEIPT_VERSION` to the previous image tag, and run `docker compose up -d --no-build`; restore the pre-upgrade backup into a separate volume if the schema changed. Preserve the current volume until the replacement is verified.
