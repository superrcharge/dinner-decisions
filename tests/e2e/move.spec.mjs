import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith, addMe, pick, stored, storedCount, noErrors } from "./helpers.mjs";

// The move from GitHub Pages to dinnerdecisions.app. In tests the old address
// is localhost with &oldhost=1 and the new one is 127.0.0.1: two origins, so
// two separate storages and two anonymous sign-ins, as on real phones.
const OLD = "http://localhost:5180/index.html?emu=1";
const NEW = /^http:\/\/127\.0\.0\.1:5180\//;
const uid = (page) => page.evaluate(() => firebase.auth().currentUser.uid);

async function familyOnOldAddress(browser, opts = {}) {
  const page = await phone(browser, { url: OLD, ...opts });
  await expect(page.locator("#barStatus")).toHaveText(/Not joined/i);
  const { code } = await startFamily(page, "The Riveras", "Ana");
  const hid = await page.evaluate(() => localStorage.getItem("dinner.householdId"));
  // A family that moves set itself up long before: its names are saved.
  await expect.poll(() => storedCount(`households/${hid}/people`)).toBe(1);
  return { page, code, hid, oldUid: await uid(page) };
}

test("a phone on the old address moves to the new one: same family, same person, no code typed", async ({ browser }) => {
  const { page, hid, oldUid } = await familyOnOldAddress(browser);

  await page.goto(OLD + "&oldhost=1");
  await page.waitForURL(NEW);
  await expect(page.locator("#dialog .dialog-title")).toHaveText("You’re all moved");
  expect(new URL(page.url()).hash, "the move is cleared from the address bar").toBe("");
  await page.screenshot({ path: "test-results/screens/move-arrived.png" });
  await page.click("#dlgCancel");

  await expect(page.locator("#whoName")).toHaveText("Ana");
  await expect(page.locator("#tab-manage")).toBeVisible();

  // The new address is a new member; the old address's place is gone, so
  // the family's device count stays honest.
  const newUid = await uid(page);
  expect(newUid).not.toBe(oldUid);
  await expect.poll(() => stored(`households/${hid}/members/${oldUid}`)).toBeNull();
  expect(await stored(`households/${hid}/members/${newUid}`)).not.toBeNull();
  noErrors(page);
});

test("a pick made just before the move, not yet sent, still reaches the family", async ({ browser }) => {
  const { page, hid } = await familyOnOldAddress(browser);
  await page.click("#starterBtn");
  await expect(page.locator(".tile")).toHaveCount(16);

  // Picked on a dead connection, so it waits in this address's own storage,
  // which the new address cannot read.
  await page.context().setOffline(true);
  await pick(page, "Tacos");
  await page.waitForTimeout(1500);
  await page.context().setOffline(false);

  await page.goto(OLD + "&oldhost=1");
  await page.waitForURL(NEW);
  await expect(page.locator("#dialog .dialog-title")).toHaveText("You’re all moved");
  const votes = await stored(`households/${hid}/votes`);
  const picked = (votes.documents || []).flatMap((d) => (d.fields.mealIds.arrayValue.values || []).map((v) => v.stringValue));
  expect(picked).toContain("tacos");
  noErrors(page);
});

test("a phone in no family, or holding an old invite link, lands on the new address ready to join", async ({ browser }) => {
  const { page: ana, code } = await familyOnOldAddress(browser);

  const fresh = await phone(browser, { url: OLD + "&oldhost=1" });
  await fresh.waitForURL(NEW);
  await expect(fresh.locator("#barStatus")).toHaveText(/Not joined/i);

  const invited = await phone(browser, { url: OLD + "&oldhost=1#join=" + code });
  await invited.waitForURL(NEW);
  await expect(invited.locator("#joinCode")).toHaveValue(code);
  await invited.click("#joinGo");
  await addMe(invited, "Ben");
  noErrors(ana, fresh, invited);
});

test("a move link cannot pull a phone out of the family it is already in", async ({ browser }) => {
  const { code: otherCode, hid: otherHid } = await familyOnOldAddress(browser);

  const ben = await phone(browser);
  await startFamily(ben, "The Bakers", "Ben");
  const bakers = await ben.evaluate(() => localStorage.getItem("dinner.householdId"));

  // The code exactly as the old address would send it (no dash), so only the
  // "already in a family" guard can stop it.
  const crafted = { h: otherHid, c: otherCode.replace("-", ""), p: "", a: 1, u: "" };
  await ben.goto("/index.html?emu=1&from=link#move=" + encodeURIComponent(JSON.stringify(crafted)));
  await expect(ben.locator("#whoName")).toHaveText("Ben");
  expect(await ben.evaluate(() => localStorage.getItem("dinner.householdId"))).toBe(bakers);
  expect(new URL(ben.url()).hash).toBe("");
  expect(await stored(`households/${otherHid}/members/${await uid(ben)}`)).toBeNull();
  noErrors(ben);
});

test("on an iPhone home screen the old icon waits for a tap that opens Safari, and Safari shows the code for the new icon", async ({ browser }) => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1";
  const { page, code, hid } = await familyOnOldAddress(browser, { userAgent: iphone });
  // Only the old address runs as the home-screen app; the new one opens in Safari.
  await page.context().addInitScript(() => {
    if (location.hostname === "localhost") Object.defineProperty(navigator, "standalone", { value: true });
  });

  await page.goto(OLD + "&oldhost=1");
  await expect(page.locator("#dialog .dialog-title")).toHaveText("Dinner Decisions has moved");
  await expect(page.locator("#moveGo")).toHaveAttribute("href", /#move=/);
  await expect(page.locator("#moveGo")).toHaveAttribute("target", "_blank");
  // Someone not expecting the move can always come back here for the code.
  await expect(page.locator("#oldIconCode")).toHaveText(code);
  await page.screenshot({ path: "test-results/screens/move-old-icon.png" });
  // The notice cannot be dismissed into a stale copy of the app.
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).toBeVisible();
  expect(page.url()).toContain("localhost");

  const [safari] = await Promise.all([page.context().waitForEvent("page"), page.click("#moveGo")]);
  await safari.waitForURL(NEW);
  await expect(safari.locator("#movedCode")).toHaveText(code);
  // Copy, so the new icon gets it by pasting.
  await safari.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5180" });
  await safari.click("#movedCopy");
  await expect(safari.locator("#movedCopy")).toHaveText("Copied");
  expect(await safari.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await safari.screenshot({ path: "test-results/screens/move-safari.png" });
  expect(await safari.evaluate(() => localStorage.getItem("dinner.householdId"))).toBe(hid);
  noErrors(page);
});
