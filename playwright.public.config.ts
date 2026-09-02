import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "public*.spec.ts",
  use: { baseURL: "http://127.0.0.1:4174", ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: {
    command: "npm run build:public && node scripts/serve-public.mjs",
    port: 4174,
    reuseExistingServer: false,
    env: { PETES_PRINTER_PUBLIC_URL: "https://example.test" },
  },
});
