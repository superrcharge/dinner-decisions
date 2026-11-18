// The Android app on an emulator or phone, against the local Firebase
// emulators. Build the test APK first:
//
//   mise run android-test

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/android",
  timeout: 240000,
  expect: { timeout: 20000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]]
});
