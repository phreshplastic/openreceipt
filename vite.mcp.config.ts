import { builtinModules } from "node:module";
import { defineConfig } from "vite";

/** The MCP server is Node code that shares the browser's renderer, so bundle it for Node. */
export default defineConfig({
  ssr: { noExternal: [/^d3-/, "internmap"] },
  build: {
    ssr: true,
    target: "node22",
    outDir: "dist-mcp",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: { server: "mcp/server.ts", runtime: "mcp/runtime.ts" },
      external: [
        ...builtinModules,
        ...builtinModules.map((name) => `node:${name}`),
        "@resvg/resvg-js",
        /^@modelcontextprotocol\//,
      ],
      output: { format: "esm", entryFileNames: "[name].mjs" },
    },
  },
});
