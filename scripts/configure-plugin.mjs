#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, mkdtempSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function main() {
  const options = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    if (flag === "--help") {
      console.log("node scripts/configure-plugin.mjs --url URL --token-file PATH [--checkout PATH] [--config PATH]\nWrites private client settings. Build the checkout first; run scripts/check-mcp.mjs afterward.");
      return;
    }
    if (!["--url", "--token-file", "--checkout", "--config"].includes(flag) || !process.argv[index + 1]) throw Error(`Unknown or incomplete option: ${flag}`);
    options[flag.slice(2)] = process.argv[index + 1];
  }
  if (!options.url || !options["token-file"]) throw Error("Provide --url and --token-file. The token itself must stay in a private file.");
  const url = new URL(options.url);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw Error("Use the bridge origin, without credentials, paths, or query parameters.");
  if (url.protocol === "http:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw Error("Use HTTPS for a remote bridge, or HTTP on loopback through an SSH forward.");
  const checkout = resolve(options.checkout ?? fileURLToPath(new URL("..", import.meta.url)));
  if (!existsSync(join(checkout, "dist-mcp/server.mjs"))) throw Error("Build the checkout first with npm ci and npm run build:mcp.");
  const tokenFile = resolve(options["token-file"]);
  if ((statSync(tokenFile).mode & 0o077) !== 0) throw Error("The token file must be private. Run chmod 600 on it first.");
  const token = readFileSync(tokenFile, "utf8").trim();
  if (!/^pp_[a-f0-9]{16}_[A-Za-z0-9_-]+$/.test(token)) throw Error("The token file is not an OpenReceipt credential.");
  const configFile = resolve(options.config ?? join(homedir(), ".config/openreceipt/client.json"));
  const previous = existsSync(configFile) ? JSON.parse(readFileSync(configFile, "utf8")) : {};
  const next = { ...previous, OPENRECEIPT_HOME: checkout, PETES_PRINTER_URL: url.origin, PETES_PRINTER_EDITOR_URL: url.origin, PETES_PRINTER_TOKEN_FILE: tokenFile };
  mkdirSync(dirname(configFile), { recursive: true, mode: 0o700 });
  const temporary = mkdtempSync(join(dirname(configFile), ".openreceipt-"));
  try {
    const staged = join(temporary, "client.json");
    writeFileSync(staged, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
    renameSync(staged, configFile);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  console.log(`Saved client settings to ${configFile}. The credential secret was not copied into configuration or printed.`);
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : "Client setup failed."); process.exitCode = 1; }
