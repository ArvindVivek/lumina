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
    // No OpenAI key unless E2E_LIVE_AI=1 (owner rule 2026-09-29: the default suite never calls the
    // model; it checks the written fallbacks). e2e/live-ai.spec.ts is the opt-in real check.
    command: process.env.E2E_LIVE_AI === "1"
      ? `TZ=UTC npm run start -- --port ${PORT}`
      : `TZ=UTC OPENAI_API_KEY= npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // Never reuse a running server: a dev server started with the key would make the suite spend.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
