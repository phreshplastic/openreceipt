import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("client setup supports spaces, preserves other settings and keeps credentials out of JSON and output", () => {
  const directory = mkdtempSync(join(tmpdir(), "openreceipt-client-"));
  try {
    const checkout = join(directory, "checkout with spaces");
    mkdirSync(join(checkout, "dist-mcp"), { recursive: true });
    writeFileSync(join(checkout, "dist-mcp/server.mjs"), "");
    const tokenFile = join(directory, "credential.token");
    const token = "pp_0123456789abcdef_fake_test_fixture";
    writeFileSync(tokenFile, token, { mode: 0o600 });
    const config = join(directory, "client.json");
    writeFileSync(config, JSON.stringify({ extraSetting: "preserved" }));
    const result = spawnSync(process.execPath, ["scripts/configure-plugin.mjs", "--url", "https://printer.example", "--token-file", tokenFile, "--checkout", checkout, "--config", config], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const output = readFileSync(config, "utf8");
    assert(!output.includes(token));
    assert(!(result.stdout + result.stderr).includes(token));
    assert.equal(JSON.parse(output).OPENRECEIPT_HOME, checkout);
    assert.equal(JSON.parse(output).extraSetting, "preserved");
    assert.equal(statSync(config).mode & 0o777, 0o600);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("client setup refuses to send a credential to a remote plaintext URL", () => {
  const result = spawnSync(process.execPath, ["scripts/configure-plugin.mjs", "--url", "http://192.0.2.1", "--token-file", "/nonexistent"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HTTPS/);
});

test("an installed launcher honors legacy environment credentials over configuration", () => {
  const directory = mkdtempSync(join(tmpdir(), "openreceipt-launch-"));
  try {
    const checkout = join(directory, "custom checkout");
    mkdirSync(join(checkout, "dist-mcp"), { recursive: true });
    writeFileSync(join(checkout, "dist-mcp/server.mjs"), "process.stdout.write(process.env.PETES_PRINTER_TOKEN === 'test-env-token' ? 'legacy-env-honored' : 'wrong-credential');");
    const config = join(directory, "client.json");
    writeFileSync(config, JSON.stringify({ OPENRECEIPT_HOME: checkout, PETES_PRINTER_TOKEN_FILE: join(directory, "missing.token") }));
    const result = spawnSync(process.execPath, [resolve("plugins/openreceipt/scripts/launch.mjs")], { encoding: "utf8", env: { ...process.env, OPENRECEIPT_HOME: checkout, OPENRECEIPT_CONFIG: config, PETES_PRINTER_TOKEN: "test-env-token" } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "legacy-env-honored");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("the read-only connection checker forwards an explicitly selected configuration", () => {
  const directory = mkdtempSync(join(tmpdir(), "openreceipt-check-"));
  try {
    const checkout = join(directory, "custom checkout");
    mkdirSync(join(checkout, "dist-mcp"), { recursive: true });
    writeFileSync(join(checkout, "dist-mcp/server.mjs"), "console.error('selected-test-checkout'); process.exit(1);");
    const tokenFile = join(directory, "credential.token");
    writeFileSync(tokenFile, "pp_0123456789abcdef_fake_test_fixture", { mode: 0o600 });
    const config = join(directory, "client.json");
    writeFileSync(config, JSON.stringify({ OPENRECEIPT_HOME: checkout, PETES_PRINTER_TOKEN_FILE: tokenFile }));
    const env = { ...process.env };
    for (const key of ["OPENRECEIPT_HOME", "PETES_PRINTER_URL", "PETES_PRINTER_EDITOR_URL", "PETES_PRINTER_TOKEN_FILE", "PETES_PRINTER_TOKEN"]) delete env[key];
    const result = spawnSync(process.execPath, [resolve("scripts/check-mcp.mjs")], { encoding: "utf8", env: { ...env, OPENRECEIPT_CONFIG: config }, timeout: 15000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /selected-test-checkout/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
