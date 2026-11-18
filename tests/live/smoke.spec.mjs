// Post-deploy smoke test against the real site and the real database.
// Two phones start a throwaway family, invite, join, vote and see the tally,
// then the family is deleted and the database is checked for leftovers.
//
// It reads Firestore as the project owner (around the rules) with the token
// `firebase login` saved, so it only runs on a machine that is signed in.
// Run with: mise run live-check

import fs from "node:fs";
import os from "node:os";
import { test, expect } from "@playwright/test";
import { phone, startFamily, addMe, tile, noErrors } from "../e2e/helpers.mjs";

// The query string gets past the edge cache, which can hold the previous
// deploy for up to ten minutes. The invite link keeps it, which is harmless.
const SITE = (process.env.LIVE_URL || "https://dinnerdecisions.app/") + "?smoke=" + Date.now();
const DB = "https://firestore.googleapis.com/v1/projects/dinner-decisions-6af97/databases/(default)/documents";

function ownerToken() {
  const file = os.homedir() + "/.config/configstore/firebase-tools.json";
  const token = JSON.parse(fs.readFileSync(file, "utf8")).tokens?.access_token;
  if (!token) throw new Error("No Firebase sign-in found. Run: npx firebase login");
  return token;
}

async function stored(path) {
  const r = await fetch(DB + "/" + path, { headers: { Authorization: "Bearer " + ownerToken() } });
  if (r.status === 404) return null;
  const j = await r.json();
  if (j.error) throw new Error(path + ": " + j.error.message + " (token may be stale: run any firebase command to refresh it)");
  return j;
}

test("a throwaway family works end to end on the live site, then leaves nothing behind", async ({ browser }) => {
  const family = "Smoke Test " + Date.now().toString(36).toUpperCase();

  const ana = await phone(browser, { url: SITE });
  await expect(ana.locator(".welcome")).toBeVisible();
  const { code, link } = await startFamily(ana, family, "Ana");
  expect(link.startsWith(SITE + "#join=")).toBe(true);
  const hid = await ana.evaluate(() => localStorage.getItem("dinner.householdId"));
  expect(hid).toMatch(/^[A-Za-z0-9]{20}$/);

  await ana.click("#starterBtn");
  await expect(ana.locator(".tile")).toHaveCount(16);

  const ben = await phone(browser, { url: link });
  await expect(ben.locator("#joinCode")).toHaveValue(code);
  await ben.click("#joinGo");
  await addMe(ben, "Ben");
  await expect(ben.locator(".tile")).toHaveCount(16);

  await (await tile(ben, "Tacos")).click();
  await (await tile(ana, "Tacos")).click();
  await ana.click("#tab-shop");
  const top = ana.locator(".tally-row").first();
  await expect(top.locator(".tally-name")).toHaveText("Tacos");
  await expect(top.locator(".tally-count")).toHaveText("2");

  await ana.click("#tab-manage");
  await ana.click("#deleteFamily");
  await ana.fill("#deleteConfirm", family);
  await ana.click("#deleteGo");
  await expect(ana.locator("#banner .notice")).toHaveText(family + " was deleted.");
  await expect(ben.locator("#banner .notice")).toContainText("no longer part of " + family);

  expect(await stored("households/" + hid)).toBeNull();
  expect(await stored("invites/" + code.replace("-", ""))).toBeNull();
  for (const c of ["meals", "people", "votes", "weeks", "suggestions", "members", "private"]) {
    const j = await stored("households/" + hid + "/" + c);
    expect(j && j.documents ? j.documents.length : 0, c).toBe(0);
  }

  noErrors(ana, ben);
});
