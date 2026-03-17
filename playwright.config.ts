import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1366, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @overbet/gateway dev",
      url: "http://127.0.0.1:4000/healthz",
      timeout: 120_000,
      reuseExistingServer: !CI,
    },
    {
      command: "pnpm --filter web dev -p 3000",
      url: "http://127.0.0.1:3000",
      timeout: 120_000,
      reuseExistingServer: !CI,
      env: {
        NEXT_PUBLIC_GATEWAY_URL: "http://127.0.0.1:4000",
      },
    },
  ],
});

