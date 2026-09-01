import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

for (let attempt = 0; attempt < 300; attempt += 1) {
  try {
    await access(resolve("dist/index.html"));
    break;
  } catch {
    if (attempt === 299) throw new Error("The web build was not ready for the live bridge test.");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
}

const dataDirectory = await mkdtemp(join(tmpdir(), "petes-printer-e2e-"));
const child = spawn(resolve("bridge/.venv/bin/petes-printer"), [
  "--port", "8732", "--data-dir", dataDirectory, "--web-dist", resolve("dist"),
], { stdio: "inherit", env: { ...process.env, PETES_PRINTER_TRANSPORT: "dummy" } });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 0));
