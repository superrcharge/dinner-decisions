import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith, addMe, pick, stored, noErrors } from "./helpers.mjs";

async function votesFor(hid, personName) {
  const j = await stored(`households/${hid}/votes`);
  return (j && j.documents ? j.documents : []).filter((d) => d.fields?.name?.stringValue === personName).length;
}

test("the welcome screen links to the four legal pages, the privacy link in the accent colour", async ({ browser }) => {
  const page = await phone(browser, { width: 375 });
  const links = page.locator(".welcome-legal a");
  await expect(links).toHaveText(["Privacy", "Terms", "Delete your data", "Accessibility"]);
  // CalOPPA wants the homepage privacy link to stand out from the text around it.
  const [link, text] = await page.evaluate(() => [
    getComputedStyle(document.querySelector(".welcome-legal a")).color,
    getComputedStyle(document.querySelector(".welcome-legal")).color
  ]);
  expect(link).not.toBe(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/screens/welcome-legal-links.png" });

  await links.first().click();
  await expect(page).toHaveURL(/privacy\.html$/);
  await expect(page.locator("h1")).toHaveText("Privacy Policy");
  noErrors(page);
});

test("a phone in a family is told once that the policy was updated, until OK is tapped", async ({ browser }) => {
  const ana = await phone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");
  const note = ana.locator(".policy-notice");
  await expect(note).toContainText("Privacy Policy and Terms were updated");
  await expect(note.locator('a[href="privacy.html"]')).toBeVisible();
  await ana.screenshot({ path: "test-results/screens/policy-notice.png" });

  await ana.click("#policyOk");
  await expect(note).toHaveCount(0);
  await ana.reload();
  await expect(ana.locator("#whoName")).toHaveText("Ana");
  await expect(note).toHaveCount(0);

  // Another phone has not tapped OK, so it is told too.
  const ben = await phone(browser);
  await joinWith(ben, code);
  await addMe(ben, "Ben");
  await expect(ben.locator(".policy-notice")).toBeVisible();
  noErrors(ana, ben);
});

test("removing a name asks first, then deletes the name and all of its votes on every phone", async ({ browser }) => {
  const ana = await phone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#starterBtn");
  const hid = await ana.evaluate(() => localStorage.getItem("dinner.householdId"));

  const ben = await phone(browser);
  await joinWith(ben, code);
  await addMe(ben, "Ben");
  await pick(ben, "Tacos");
  await pick(ana, "Pizza");
  await expect.poll(() => votesFor(hid, "Ben")).toBe(1);

  await ana.click("#tab-manage");
  const row = ana.locator("#peopleRows .row", { hasText: "Ben" });
  await row.locator("[data-rmperson]").click();
  await expect(ana.locator("#dialog .dialog-title")).toHaveText("Remove Ben?");
  await expect(ana.locator("#dialog")).toContainText("all of its votes");

  // Cancel leaves everything as it was.
  await ana.click("#dlgCancel");
  await expect(row).toHaveCount(1);
  expect(await votesFor(hid, "Ben")).toBe(1);

  await row.locator("[data-rmperson]").click();
  await ana.click("#removePersonGo");
  await expect(ana.locator("#dialog")).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await expect.poll(() => votesFor(hid, "Ben")).toBe(0);
  expect(await votesFor(hid, "Ana")).toBe(1);

  // Ben's phone sees the name go too.
  await ben.click("#whoBtn");
  await expect(ben.locator("#whoMenu [data-person]")).toHaveText(["Ana"]);
  noErrors(ana, ben);
});
