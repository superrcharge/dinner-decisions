import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith, addMe, CODE_SHAPE, noErrors } from "./helpers.mjs";

// A phone on a weak signal, or one just woken up, has not reconnected yet
// when someone taps Invite. The family's code must still show.

test("a phone that briefly loses its connection still gets the family code", async ({ browser }) => {
  const ana = await phone(browser);
  await startFamily(ana, "The Riveras", "Ana");
  const ben = await phone(browser);
  await ana.click("#whoBtn");
  await ana.click("#inviteBtn");
  await expect(ana.locator("#codeShow")).toHaveText(CODE_SHAPE);
  const code = await ana.textContent("#codeShow");
  await joinWith(ben, code);
  await addMe(ben, "Ben");

  // Ben has never seen the code on this phone, so it has to come from the
  // server once the connection is back.
  await ben.context().setOffline(true);
  await ben.waitForTimeout(1500);
  await ben.click("#whoBtn");
  await ben.click("#inviteBtn");
  await ben.waitForTimeout(2500);
  await ben.context().setOffline(false);
  await expect(ben.locator("#codeShow")).toHaveText(code, { timeout: 15000 });
  await expect(ben.locator("#dlgError")).toHaveText("");
  noErrors(ana, ben);
});

test("with no connection at all, a phone that has the code shows it", async ({ browser }) => {
  const ana = await phone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");

  // A fresh start, so the code is not just remembered by the open page.
  await ana.reload();
  await expect(ana.locator("#whoName")).toHaveText("Ana");
  await ana.context().setOffline(true);
  await ana.waitForTimeout(1500);
  await ana.click("#whoBtn");
  await ana.click("#inviteBtn");
  await expect(ana.locator("#codeShow")).toHaveText(code, { timeout: 25000 });
  noErrors(ana);
});
