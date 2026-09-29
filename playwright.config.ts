import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Specs read the same env as the server (Overdraft's lesson: without this the test process
// sees empty values).
loadEnvConfig(process.cwd());

/** E2E runs against the production build (`npm run build` first). Own port: 3561. */
const PORT = process.env.E2E_PORT ?? "3561";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // One worker: this Mac is shared, and a Next server plus several browsers at once runs it
  // out of memory (docs/web/testing.md).
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // The browser runs in Los Angeles time and the server in UTC, so a date rendered on the server
  // and again in the browser would differ; that catches React #418 hydration bugs.
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure", timezoneId: "America/Los_Angeles" },
  projects: [
    { name: "phone", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // No OpenAI key in e2e: the suite checks the written fallbacks and never spends tokens.
    command: `TZ=UTC OPENAI_API_KEY= npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
