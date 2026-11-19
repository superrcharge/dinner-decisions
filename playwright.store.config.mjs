// Store screenshots (tests/store), against the local emulators.
//
//   mise run store-screenshots

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/store",
  timeout: 600000,
  expect: { timeout: 20000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  webServer: {
    command: "node tests/serve.mjs 5180",
    url: "http://127.0.0.1:5180/index.html",
    reuseExistingServer: true
  }
});
