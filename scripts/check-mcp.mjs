#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fileURLToPath } from "node:url";

const client = new Client({ name: "OpenReceipt connection check", version: "1" });
const launcherEnvironment = Object.fromEntries(["OPENRECEIPT_CONFIG", "OPENRECEIPT_HOME", "PETES_PRINTER_URL", "PETES_PRINTER_EDITOR_URL", "PETES_PRINTER_TOKEN_FILE", "PETES_PRINTER_TOKEN"]
  .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../plugins/openreceipt/scripts/launch.mjs", import.meta.url))], env: launcherEnvironment }));
  const [status, receipts] = await Promise.all([
    client.callTool({ name: "get_app_status", arguments: {} }),
    client.callTool({ name: "list_receipts", arguments: {} }),
  ]);
  for (const result of [status, receipts]) if (result.isError) throw Error(result.content.find((item) => item.type === "text")?.text ?? "MCP call failed.");
  const saved = receipts.structuredContent.receipts;
  let imageReturned = false;
  if (saved.length) {
    const preview = await client.callTool({ name: "preview_receipt", arguments: { receiptId: saved[0].receiptId } });
    if (preview.isError) throw Error("The saved receipt preview failed.");
    imageReturned = preview.content.some((item) => item.type === "image");
    if (!imageReturned) throw Error("The server did not return its canonical image preview.");
  }
  const state = status.structuredContent;
  console.log(JSON.stringify({ bridgeOnline: state.bridgeOnline, printerConnected: state.printerConnected,
    printerReady: state.printerReady, queuePaused: state.queuePaused, printPolicy: state.printPolicy,
    savedReceiptCount: saved.length, imageReturned, printed: false }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : "Connection check failed."); process.exitCode = 1; }
finally { await client.close(); }
