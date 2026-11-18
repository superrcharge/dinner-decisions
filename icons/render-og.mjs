// Renders icons/og.html to icons/og-image.png, the 1200x630 link preview card.
// Uses the Playwright Chromium the tests already install, and needs network
// access for the Google Fonts the card uses.
//
//   node icons/render-og.mjs

import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(join(here, "og.html")).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(here, "og-image.png") });
  console.log("  og-image.png");
} finally {
  await browser.close();
}
