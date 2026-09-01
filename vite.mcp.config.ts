import { builtinModules } from "node:module";
import { defineConfig } from "vite";

/** The MCP server is Node code that shares the browser's renderer, so bundle it for Node. */
export default defineConfig({
  build: {
    ssr: true,
    target: "node22",
    outDir: "dist-mcp",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: "mcp/server.ts",
      external: [
        ...builtinModules,
        ...builtinModules.map((name) => `node:${name}`),
        "@resvg/resvg-js",
        /^@modelcontextprotocol\//,
      ],
      output: { format: "esm", entryFileNames: "server.mjs" },
    },
  },
});
