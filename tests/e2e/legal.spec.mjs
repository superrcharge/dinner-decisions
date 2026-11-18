import { test, expect } from "@playwright/test";
import { phone, noErrors } from "./helpers.mjs";

const PAGES = [
  ["Privacy", "privacy.html", "Privacy Policy"],
  ["Terms", "terms.html", "Terms of Use"],
  ["Delete your data", "delete.html", "Delete your data"],
  ["Accessibility", "accessibility.html", "Accessibility"]
];

test("the help screen links to the privacy, terms, deletion and accessibility pages, and each leads back", async ({ browser }) => {
  const page = await phone(browser, { width: 375 });
  await page.click("#helpBtn");
  const links = page.locator(".help-legal a");
  await expect(links).toHaveText(PAGES.map((p) => p[0]));
  await page.locator(".help-legal").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/screens/help-legal-links.png" });

  for (const [label, file, heading] of PAGES) {
    await page.goto("/index.html?emu=1");
    await page.click("#helpBtn");
    await page.click(`.help-legal a:text-is("${label}")`);
    await expect(page).toHaveURL(new RegExp(file.replace(".", "\\.") + "$"));
    await expect(page.locator("h1")).toHaveText(heading);
    // Readable on a small phone: nothing runs off the side.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // No placeholder left for the reader.
    await expect(page.locator(".placeholder")).toHaveCount(0);
    await page.screenshot({ path: `test-results/screens/legal-${file.replace(".html", "")}.png`, fullPage: false });
  }

  // The pages lead back to the app.
  await page.locator("a", { hasText: "Open the app" }).first().click();
  await expect(page.locator("#helpBtn")).toBeVisible();
  noErrors(page);
});
