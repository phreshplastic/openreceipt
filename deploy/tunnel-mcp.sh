#!/usr/bin/env bash
set -euo pipefail
cd "${OPENRECEIPT_HOME:-$HOME/openreceipt}"
export PETES_PRINTER_TOKEN
PETES_PRINTER_TOKEN="$(cat "${OPENRECEIPT_CHATGPT_TOKEN_FILE:-$HOME/openreceipt-tunnel/chatgpt.token}")"
exec docker compose exec -T -e PETES_PRINTER_TOKEN mcp node dist-mcp/server.mjs
