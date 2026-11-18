// "Delete my data": what both app stores call deleting an account. One phone
// removes its own place in the family, its name and that name's votes, the
// anonymous sign-in, and everything it keeps locally. The family stays.

import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith, addMe, tile, pick, stored, storedCount, seed, noErrors } from "./helpers.mjs";

const AUTH = "http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/projects/demo-dinner-decisions";

async function authUserExists(uid) {
  const r = await fetch(AUTH + "/accounts:lookup", {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ localId: [uid] })
  });
  const j = await r.json();
  return Array.isArray(j.users) && j.users.length > 0;
}

const uidOf = (page) => page.evaluate(() => firebase.auth().currentUser && firebase.auth().currentUser.uid);

test("delete my data takes one phone, its name and its votes out, and leaves the family", async ({ browser }) => {
  const ana = await phone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#starterBtn");
  await expect(ana.locator(".tile")).toHaveCount(16);
  const hid = await ana.evaluate(() => localStorage.getItem("dinner.householdId"));

  const ben = await phone(browser);
  await joinWith(ben, code);
  await addMe(ben, "Ben");
  await pick(ben, "Chili");
  await pick(ana, "Chili");
  const benUid = await uidOf(ben);
  const benPid = await ben.evaluate((h) => localStorage.getItem("dinner." + h + ".personId"), hid);
  // A vote from an earlier week goes too, not just this week's.
  await seed("households/" + hid + "/votes/2020-01-05__" + benPid, { weekId: "2020-01-05", personId: benPid, name: "Ben" });
  await expect.poll(() => storedCount("households/" + hid + "/votes")).toBe(3);

  // Reachable from the name menu by anyone in the family.
  await ben.click("#whoBtn");
  await ben.click("#deleteMine");
  const dlg = ben.locator("#dialog");
  await expect(dlg).toContainText("Delete your data on this phone?");
  await expect(dlg).toContainText("removes the name Ben and its votes");
  await expect(dlg).toContainText("Delete this family");
  await expect(dlg.locator("#deleteMineMore")).toHaveAttribute("href", "delete.html");
  await expect(ben.locator("#deleteMineGo")).toHaveText("Delete My Data");

  // With no signal nothing is lost: it says so and can be tried again.
  await ben.context().setOffline(true);
  await ben.click("#deleteMineGo");
  await expect(ben.locator("#dlgError")).toHaveText(/No connection/, { timeout: 30000 });
  await expect(ben.locator("#deleteMineGo")).toBeEnabled();
  expect(await stored("households/" + hid + "/members/" + benUid)).not.toBeNull();
  await ben.context().setOffline(false);

  await ben.click("#deleteMineGo");
  await expect(ben.locator(".welcome")).toBeVisible();
  await expect(ben.locator("#banner .notice")).toHaveText("Your data was deleted from this phone.");
  await expect(ben.locator("#barStatus")).toHaveText(/Not joined/i);

  // On the phone: a new, unconnected sign-in, and nothing of the family.
  await expect.poll(() => uidOf(ben)).toBeTruthy();
  expect(await uidOf(ben)).not.toBe(benUid);
  expect(await authUserExists(benUid)).toBe(false);
  expect(await ben.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf("dinner.") === 0 && k !== "dinner.manager"))).toEqual([]);
  // The notice is shown once, not on every start.
  await ben.reload();
  await expect(ben.locator(".welcome")).toBeVisible();
  await expect(ben.locator("#banner .notice")).toHaveCount(0);

  // In the family: Ben's membership, name and votes are gone; Ana's are not.
  expect(await stored("households/" + hid + "/members/" + benUid)).toBeNull();
  expect(await stored("households/" + hid + "/people/" + benPid)).toBeNull();
  expect(await storedCount("households/" + hid + "/votes")).toBe(1);
  expect(await storedCount("households/" + hid + "/members")).toBe(1);
  await expect(ana.locator(".tile")).toHaveCount(16);
  await ana.click("#whoBtn");
  await expect(ana.locator("#whoMenu [data-person]")).toHaveText(["Ana"]);
  await ana.click("#sheetBackdrop");
  await expect(await tile(ana, "Chili")).toHaveAttribute("aria-pressed", "true");

  // Manage offers it too, beside Delete this family, and Cancel keeps everything.
  await ana.click("#tab-manage");
  await ana.click("#deleteMineManage");
  await expect(ana.locator("#dialog")).toContainText("removes the name Ana and its votes");
  await ana.click("#dlgCancel");
  await expect(ana.locator("#dialog")).toHaveCount(0);
  expect(await storedCount("households/" + hid + "/members")).toBe(1);

  noErrors(ana, ben);
});
