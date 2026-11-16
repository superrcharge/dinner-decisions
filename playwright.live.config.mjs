// Runs tests/live against the deployed site. No local server, no emulators.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/live",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { trace: "retain-on-failure" }
});
