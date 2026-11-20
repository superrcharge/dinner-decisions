import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith, addMe, stored, CODE_SHAPE, noErrors } from "./helpers.mjs";

// An iPhone app that comes back from the background has a dead connection,
// but the phone never reports going offline. The family's code must still show.

async function wakeTest(browser, mode) {
  const ana = await phone(browser);
  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#whoBtn");
  await ana.click("#inviteBtn");
  await expect(ana.locator("#codeShow")).toHaveText(CODE_SHAPE);
  const code = await ana.textContent("#codeShow");
  const ben = await phone(browser);
  await joinWith(ben, code);
  await addMe(ben, "Ben");
  // A name is written without waiting for the server. Let it land before the
  // reload takes the page, and its pending write, away.
  const hid = (await stored("invites/" + code.replace("-", ""))).fields.hid.stringValue;
  await expect.poll(async () => JSON.stringify(await stored("households/" + hid + "/people"))).toContain("Ben");
  await ben.reload();
  await expect(ben.locator("#whoName")).toHaveText("Ben");

  const cut = (route) => (mode === "abort" ? route.abort("connectionreset") : new Promise(() => {}));
  await ben.context().route(/google\.firestore\.v1\.Firestore/, cut);
  await ben.waitForTimeout(60000);
  await ben.context().unroute(/google\.firestore\.v1\.Firestore/, cut);
  await ben.click("#whoBtn");
  await ben.click("#inviteBtn");
  await expect(ben.locator("#codeShow")).toHaveText(code, { timeout: 15000 });
  await expect(ben.locator("#dlgError")).toHaveText("");
  noErrors(ana, ben);
}

test("a phone back from the background, its requests failing, still gets the code", async ({ browser }) => {
  test.setTimeout(150000);
  await wakeTest(browser, "abort");
});

test("a phone back from the background, its requests hanging, still gets the code", async ({ browser }) => {
  test.setTimeout(150000);
  await wakeTest(browser, "hang");
});
