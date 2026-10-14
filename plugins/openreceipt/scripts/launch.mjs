import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const configPath = process.env.OPENRECEIPT_CONFIG ?? join(homedir(), ".config/openreceipt/client.json");
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
const env = { ...process.env };
for (const key of ["OPENRECEIPT_HOME", "PETES_PRINTER_URL", "PETES_PRINTER_EDITOR_URL", "PETES_PRINTER_TOKEN_FILE"]) {
  if (!env[key] && typeof config[key] === "string") env[key] = config[key];
}
if (!env.OPENRECEIPT_HOME) throw new Error("Configure OPENRECEIPT_HOME or ~/.config/openreceipt/client.json first. See the plugin README.");
if (!process.env.PETES_PRINTER_TOKEN && env.PETES_PRINTER_TOKEN_FILE) env.PETES_PRINTER_TOKEN = readFileSync(env.PETES_PRINTER_TOKEN_FILE, "utf8").trim();
if (!env.PETES_PRINTER_TOKEN) throw new Error("Configure a scoped credential through PETES_PRINTER_TOKEN_FILE before using OpenReceipt.");
const entry = join(env.OPENRECEIPT_HOME, "dist-mcp/server.mjs");
if (!existsSync(entry)) throw new Error("Build the configured OpenReceipt checkout with npm ci and npm run build:mcp first.");
const child = spawn(process.execPath, [entry], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
