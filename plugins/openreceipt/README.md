# OpenReceipt plugin

This package connects an agent to **your** OpenReceipt bridge. It includes receipt and setup skills and a stdio MCP launcher. Each installation uses its own scoped bridge credential. ChatGPT's cloud connection uses its owner's Secure MCP Tunnel; this package does not share the project's personal tunnel.

Install Node.js 24+, clone OpenReceipt on the computer running Codex, and run `npm ci` and `npm run build:mcp`. The plugin launches the compiled MCP server from that checkout, which talks to the printer host over its private URL. Keep the checkout available after installing the plugin.

Create a credential on the printer host with `python3 scripts/setup-host.py token --name codex --token-file "$HOME/.config/openreceipt/codex.token"`. Add `--automatic` only to grant automatic-print permission explicitly; the bridge's owner policy still applies. Copy that mode-0600 file securely to the Codex computer, then configure it:

```bash
node scripts/configure-plugin.mjs \
  --url https://YOUR-PI.YOUR-TAILNET.ts.net \
  --token-file "$HOME/.config/openreceipt/codex.token"
node scripts/check-mcp.mjs
codex plugin marketplace add "$PWD"
codex plugin add openreceipt@openreceipt
```

The configuration helper writes `~/.config/openreceipt/client.json` with the checkout, bridge origin, and token **file path**. It does not put the secret in JSON or output. Use `client.example.json` for manual configuration. Explicit `OPENRECEIPT_HOME`, `PETES_PRINTER_URL`, `PETES_PRINTER_EDITOR_URL`, and `PETES_PRINTER_TOKEN_FILE` environment variables override the corresponding settings. `OPENRECEIPT_CONFIG` selects another configuration file. Legacy `PETES_PRINTER_TOKEN` environment credentials remain supported.

Start a new Codex chat and ask it to find your saved receipts, create a shopping list without printing, preview it, and print only when requested. `check-mcp.mjs` performs read-only status/list/preview checks and never prints. An empty installation has no saved receipt to preview yet.

If migrating from the previous personal marketplace, install and verify `openreceipt@openreceipt` first, then run `codex plugin remove openreceipt@openreceipt-video`. Avoid duplicate enabled connections to the same printer.

For other MCP clients, use the same `mcpServers.openreceipt` configuration with `bash /absolute/path/to/openreceipt/plugins/openreceipt/scripts/mcp.sh`, or the private HTTP MCP endpoint with a bearer credential. Compatibility with other clients has not been verified. See the checkout's `deploy/README.md` for the Docker host, private networking, ChatGPT tunnel, backup and recovery instructions.
