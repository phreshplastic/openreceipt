import { createServer } from "node:http";
import { renderCanonical } from "./render";

const port = Number(process.env.PETES_PRINTER_RENDER_PORT ?? 8734);
const host = process.env.PETES_PRINTER_RENDER_HOST ?? "127.0.0.1";
const server = createServer((req, res) => {
  void (async () => {
    if (req.url === "/healthz") { res.end('{"status":"ok"}'); return; }
    if (req.method !== "POST" || req.url !== "/render") { res.writeHead(404).end(); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1_000_000) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const { document } = JSON.parse(Buffer.concat(chunks).toString());
    const rendered = renderCanonical(document);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(rendered));
  })().catch((error) => {
    if (!res.headersSent) res.writeHead(422, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Render failed" }));
  });
});
server.listen(port, host, () => process.stderr.write(`Receipt renderer on ${host}:${port}\n`));
