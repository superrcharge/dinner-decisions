// One phone shared by several people: each taps their dinners, then hands
// the phone on. Every person's picks must reach the family, however quickly
// the next person starts tapping, and however the family's other votes
// arrive while someone is tapping.

import { test, expect } from "@playwright/test";
import { phone, startFamily, pick, stored, noErrors } from "./helpers.mjs";

test("on a shared phone, switching names straight after a tap keeps both people's picks", async ({ browser }) => {
  const ana = await phone(browser);
  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#whoBtn");
  await ana.click("#showAddName");
  await ana.fill("#personInput", "Ben");
  await ana.click("#personAdd");
  await expect(ana.locator("#whoName")).toHaveText("Ben");
  await ana.click("#starterBtn");
  await expect(ana.locator(".tile")).toHaveCount(16);

  // Ben taps Tacos and hands the phone straight to Ana, who taps Pizza
  // before Ben's tap has been sent.
  await pick(ana, "Tacos");
  await ana.click("#whoBtn");
  await ana.click('#whoMenu [data-person]:has-text("Ana")');
  await expect(ana.locator("#whoName")).toHaveText("Ana");
  // Ana taps several, a moment apart, so Ben's vote reaches the family
  // while hers are still waiting to be sent. None of hers may be lost.
  for (const meal of ["Pizza", "Chili", "Burgers", "Fajitas"]) {
    await pick(ana, meal);
    await ana.waitForTimeout(150);
  }

  const hid = await ana.evaluate(() => localStorage.getItem("dinner.householdId"));
  const votes = async () => {
    const j = await stored("households/" + hid + "/votes");
    return (j && j.documents || []).map((d) => d.fields.name.stringValue + ":" +
      (d.fields.mealIds.arrayValue.values || []).map((v) => v.stringValue).join(",")).sort();
  };
  await expect.poll(votes, { timeout: 10000 }).toEqual(["Ana:pizza,chili,burgers,fajitas", "Ben:tacos"]);

  // And the tally shows both meals.
  await ana.click("#tab-shop");
  await expect(ana.locator(".tally-row")).toHaveCount(5);
  noErrors(ana);
});
