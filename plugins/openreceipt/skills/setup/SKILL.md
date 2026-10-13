---
name: setup
description: Configure a personal OpenReceipt MCP connection and verify the printer status after installing the plugin.
---

Connect to the owner's OpenReceipt installation. Read `../../README.md` relative to this skill directory for client configuration and plugin installation. The stdio wrapper needs `OPENRECEIPT_HOME`, `PETES_PRINTER_URL`, and a scoped token through `PETES_PRINTER_TOKEN_FILE`. Read `deploy/README.md` in that configured checkout when provisioning the Docker host or ChatGPT tunnel. Every owner creates their own tunnel and credentials; never use a project maintainer's personal connection. Keep tokens out of conversation output.

Call `get_app_status` and distinguish a reachable bridge from a connected physical printer or virtual output. Check the effective print policy. If the owner wants trusted automatic printing, provision a credential with `print:automatic` and enable the bridge's autonomous policy; review-mode credentials continue to require approval.

List saved receipts and preview one without printing. Setup is complete when the connection reads the shared receipt, returns its preview, and reports the configured printer and effective policy. A physical test print is a separate, explicit action.
