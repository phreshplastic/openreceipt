import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Every public-* spec belongs to playwright.public.config.ts, which serves the separate
  // crawlable build; run against this preview they would be testing the wrong site.
  testIgnore: "public*.spec.ts",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4173", trace: "on-first-retry" },
  webServer: [
    { command: "npm run build && npx vite preview --host 127.0.0.1", port: 4173, reuseExistingServer: true },
    { command: "node scripts/run-e2e-bridge.mjs", port: 8732, reuseExistingServer: false },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined } }],
});
