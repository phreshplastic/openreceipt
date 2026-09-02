import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "virtual:runtime-entry": resolve(process.cwd(), mode === "public" ? "src/public-entry.ts" : "src/local-entry.ts"),
    },
  },
  server: {
    headers: {
      "Origin-Agent-Cluster": "?1",
      "Permissions-Policy": "tools=(self)",
    },
    proxy: {
      "/api": "http://127.0.0.1:8731",
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "mcp/**/*.test.ts"],
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost" } },
    setupFiles: ["./src/test/setup.ts"],
    coverage: { reporter: ["text", "html"] },
  },
  build: mode === "public" ? { manifest: true } : undefined,
}));
