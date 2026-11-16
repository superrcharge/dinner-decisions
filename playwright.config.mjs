// Browser tests: two or three phones at once against the local emulators.
//
//   mise run e2e                       starts the emulators, runs, stops them
//   npx playwright test                when the emulators are already running

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  expect: { timeout: 15000 },
  // The phones in one test talk to each other through the emulator, and the
  // emulator is shared, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5180"
  },
  webServer: {
    command: "node tests/serve.mjs 5180",
    url: "http://127.0.0.1:5180/index.html",
    reuseExistingServer: true
  }
});
