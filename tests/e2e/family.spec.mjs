import { test, expect } from "@playwright/test";
import {
  phone, startFamily, joinWith, addMe, tile, stored, storedCount, seed, noErrors, CODE_SHAPE
} from "./helpers.mjs";

test("start a family, invite by link and by typed code, vote, see the tally", async ({ browser }) => {
  const ana = await phone(browser);
  const { code, link } = await startFamily(ana, "The Riveras", "Ana");
  expect(link).toContain("#join=" + code.replace("-", ""));

  // The creator holds Manage straight away and sees the starter offer.
  await expect(ana.locator("#tab-manage")).toBeVisible();
  await ana.click("#starterBtn");
  await expect(ana.locator(".tile")).toHaveCount(16);

  // Second phone arrives by tapping the link.
  const ben = await phone(browser, { url: link });
  await expect(ben.locator("#joinCode")).toHaveValue(code);
  expect(new URL(ben.url()).hash, "code is cleared from the address bar").toBe("");
  await ben.click("#joinGo");
  await expect(ben.locator("#whoMenu")).toContainText("The Riveras");
  await expect(ben.locator("#whoMenu [data-person]")).toHaveText(["Ana"]);
  await addMe(ben, "Ben");
  await expect(ben.locator(".tile")).toHaveCount(16);
  await expect(ben.locator("#tab-manage")).toBeHidden();

  // Third phone types it, sloppily: lower case, a space instead of the dash.
  const cal = await phone(browser);
  await joinWith(cal, " " + code.toLowerCase().replace("-", " ") + " ");
  await addMe(cal, "Cal");

  await (await tile(ben, "Tacos")).click();
  await (await tile(ana, "Tacos")).click();
  await (await tile(ana, "Pizza")).click();
  await expect(await tile(ana, "Tacos")).toHaveAttribute("aria-pressed", "true");

  await ana.click("#tab-shop");
  const top = ana.locator(".tally-row").first();
  await expect(top.locator(".tally-name")).toHaveText("Tacos");
  await expect(top.locator(".tally-count")).toHaveText("2");
  await expect(top.locator(".tally-who")).toHaveText("Ana, Ben");
  await expect(ana.locator("#waitingLine")).toHaveText("Still waiting on Cal.");

  // Opening your own family's link again is harmless.
  const again = await ana.context().newPage();
  again.errors = [];
  again.on("pageerror", (e) => again.errors.push(e.message));
  await again.goto(link);
  await again.click("#joinGo");
  await expect(again.locator("#dialog")).toHaveCount(0);
  await expect(again.locator("#whoName")).toHaveText("Ana");

  noErrors(ana, ben, cal, again);
});

test("a tap made before sign-in finishes waits for it instead of failing", async ({ browser }) => {
  const ana = await phone(browser, { holdSignIn: true });
  await ana.click("#welcomeStart");
  await ana.fill("#startFamily", "The Riveras");
  await ana.fill("#startName", "Ana");
  await ana.click("#startGo");
  await expect(ana.locator("#startGo")).toHaveText("Connecting…");
  await expect(ana.locator("#startGo")).toBeDisabled();
  await expect(ana.locator("#dlgError")).toBeEmpty();

  ana.releaseSignIn();
  await expect(ana.locator("#codeShow")).toHaveText(CODE_SHAPE);
  const code = await ana.textContent("#codeShow");
  await ana.click("#dlgCancel");
  await expect(ana.locator("#whoName")).toHaveText("Ana");

  // The same for a join typed before sign-in.
  const ben = await phone(browser, { holdSignIn: true });
  await joinWith(ben, code);
  await expect(ben.locator("#joinGo")).toHaveText("Connecting…");
  ben.releaseSignIn();
  await addMe(ben, "Ben");

  noErrors(ana, ben);
});

test("the ? explains the app, before and after joining a family", async ({ browser }) => {
  const ana = await phone(browser);
  await ana.click("#helpBtn");
  await expect(ana.locator("#dialog .dialog-title")).toHaveText("How it works");
  await expect(ana.locator(".help-head").first()).toHaveText("Get started");
  await ana.click("#dlgCancel");
  await expect(ana.locator("#dialog")).toHaveCount(0);

  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#helpBtn");
  await expect(ana.locator(".help-head").first()).toHaveText("Add your family");
  await expect(ana.locator(".help-head")).toHaveCount(7);
  await ana.click("#dlgClose");
  await expect(ana.locator("#dialog")).toHaveCount(0);

  // On a short screen only the middle scrolls: the X and Done stay in view.
  await ana.setViewportSize({ width: 440, height: 600 });
  await ana.click("#helpBtn");
  await expect(ana.locator("#dlgClose")).toBeInViewport({ ratio: 1 });
  await expect(ana.locator("#dlgCancel")).toBeInViewport({ ratio: 1 });
  await ana.click("#sheetBackdrop", { position: { x: 5, y: 590 } });
  await expect(ana.locator("#dialog")).toHaveCount(0);
  noErrors(ana);
});

test("every tile is two lines tall; a longer name is cut short and kept in full elsewhere", async ({ browser }) => {
  const ana = await phone(browser, { width: 375 });
  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#starterBtn");
  await ana.click("#tab-manage");
  const long = "Sheet Pan Lemon Herb Chicken with Potatoes";
  for (const name of ["Gnocchi and Italian Sausage Soup", long]) {
    await ana.fill("#manageAddInput", name);
    await ana.click("#manageAddBtn");
  }
  await ana.click("#tab-pick");
  await expect(ana.locator(".tile")).toHaveCount(18);

  const heights = async () => new Set(await ana.locator(".tile").evaluateAll((ts) => ts.map((t) => Math.round(t.getBoundingClientRect().height))));
  expect(await heights()).toEqual(new Set([125]));

  // On a phone only the name that needs a third line is cut, and only it
  // carries a tooltip.
  const titled = () => ana.locator(".tile[title]").evaluateAll((ts) => ts.map((t) => t.title));
  expect(await titled()).toEqual([long]);

  // Picking it shows the whole name in Your picks.
  await (await tile(ana, long)).click();
  await expect(ana.locator(".mypick-name")).toHaveText(long);

  // A wider window has narrower tiles, so more names are cut.
  await ana.setViewportSize({ width: 1100, height: 900 });
  await expect.poll(titled).toEqual(["Gnocchi and Italian Sausage Soup", long]);
  expect(await heights()).toEqual(new Set([125]));
  noErrors(ana);
});

test("bad, unknown and replaced codes each say what went wrong", async ({ browser }) => {
  const ana = await phone(browser);
  const first = (await startFamily(ana, "The Riveras", "Ana")).code;

  const ben = await phone(browser);
  await joinWith(ben, "abc");
  await expect(ben.locator("#dlgError")).toContainText("10 letters and numbers");
  await ben.fill("#joinCode", "ABCDE-FGHJK");
  await ben.click("#joinGo");
  await expect(ben.locator("#dlgError")).toContainText("No family uses that code");

  // A new code from Manage: the old one stops working at once.
  await ana.click("#tab-manage");
  await ana.click("#manageNewCode");
  await ana.click("#newCodeGo");
  await expect(ana.locator("#codeShow")).toHaveText(CODE_SHAPE);
  const second = await ana.textContent("#codeShow");
  expect(second).not.toBe(first);
  expect(await stored("invites/" + first.replace("-", ""))).toBeNull();

  await ben.fill("#joinCode", first);
  await ben.click("#joinGo");
  await expect(ben.locator("#dlgError")).toContainText("No family uses that code");
  await ben.fill("#joinCode", second);
  await ben.click("#joinGo");
  await addMe(ben, "Ben");

  noErrors(ana, ben);
});

test("families cannot see each other", async ({ browser }) => {
  const ana = await phone(browser);
  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#starterBtn");
  const anaHid = await ana.evaluate(() => localStorage.getItem("dinner.householdId"));

  const eve = await phone(browser);
  await startFamily(eve, "Eve's House", "Eve");
  await expect(eve.locator(".tile")).toHaveCount(0);

  // What someone could type into the browser console.
  const tries = await eve.evaluate(async (hid) => {
    const db = firebase.firestore();
    const out = {};
    const attempt = async (k, f) => { try { await f(); out[k] = "allowed"; } catch (e) { out[k] = e.code; } };
    await attempt("readMeals", () => db.collection("households/" + hid + "/meals").get({ source: "server" }));
    await attempt("readCode", () => db.doc("households/" + hid + "/private/join").get({ source: "server" }));
    await attempt("listFamilies", () => db.collection("households").get({ source: "server" }));
    await attempt("listInvites", () => db.collection("invites").get({ source: "server" }));
    await attempt("writeMeal", () => db.doc("households/" + hid + "/meals/x").set({ name: "X" }));
    await attempt("deleteFamily", () => db.doc("households/" + hid).delete());
    return out;
  }, anaHid);
  expect(tries).toEqual({
    readMeals: "permission-denied",
    readCode: "permission-denied",
    listFamilies: "permission-denied",
    listInvites: "permission-denied",
    writeMeal: "permission-denied",
    deleteFamily: "permission-denied"
  });

  noErrors(ana, eve);
});

test("leave, come back, then delete the family for everyone", async ({ browser }) => {
  const ana = await phone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#starterBtn");
  await expect(ana.locator(".tile")).toHaveCount(16);
  const hid = await ana.evaluate(() => localStorage.getItem("dinner.householdId"));

  const ben = await phone(browser);
  await joinWith(ben, code);
  await addMe(ben, "Ben");
  await (await tile(ben, "Chili")).click();

  // Leave on this phone only.
  await ben.click("#whoBtn");
  await ben.click("#leaveFamily");
  await ben.click("#leaveGo");
  await expect(ben.locator(".welcome")).toBeVisible();
  await expect(ben.locator("#banner .notice")).toHaveText("You left The Riveras on this phone.");
  expect(await ben.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf("dinner.") === 0 && k !== "dinner.manager"))).toEqual([]);
  await expect(ana.locator(".tile")).toHaveCount(16);

  // And back again with the same code.
  await joinWith(ben, code);
  await expect(ben.locator("#whoMenu [data-person]")).toHaveText(["Ana", "Ben"]);
  await ben.click('#whoMenu [data-person]:has-text("Ben")');

  // Delete: armed only by typing the family's name.
  await ana.click("#tab-manage");
  await ana.click("#deleteFamily");
  await expect(ana.locator("#deleteGo")).toBeDisabled();
  await ana.fill("#deleteConfirm", "The Rivers");
  await expect(ana.locator("#deleteGo")).toBeDisabled();
  await ana.fill("#deleteConfirm", "the riveras");
  await expect(ana.locator("#deleteGo")).toBeEnabled();
  await ana.click("#deleteGo");

  await expect(ana.locator("#banner .notice")).toHaveText("The Riveras was deleted.");
  await expect(ben.locator("#banner .notice")).toHaveText(
    "This phone is no longer part of The Riveras. Ask for an invite code to join again.");

  // Nothing is left behind.
  expect(await stored("households/" + hid)).toBeNull();
  expect(await stored("invites/" + code.replace("-", ""))).toBeNull();
  for (const c of ["meals", "people", "votes", "weeks", "suggestions", "members", "private"]) {
    expect(await storedCount("households/" + hid + "/" + c), c).toBe(0);
  }

  noErrors(ana, ben);
});

test("a family from before invites moves to a strong code the first time it invites", async ({ browser }) => {
  const hid = "legacy" + Date.now();
  await seed("households/" + hid, { name: "Charge" });
  await seed("households/" + hid + "/private/join", { code: "pizza" });
  await seed("households/" + hid + "/meals/tacos", { name: "Tacos", createdAt: "2026-09-01T00:00:00.000Z" });

  // A phone that joined the old way: the old page wrote this member record
  // and remembered the family in localStorage.
  const dad = await phone(browser);
  await dad.evaluate(async (hid) => {
    const uid = firebase.auth().currentUser.uid;
    await firebase.firestore().doc("households/" + hid + "/members/" + uid)
      .set({ code: "pizza", joinedAt: new Date().toISOString() });
    localStorage.setItem("dinner.householdId", hid);
    localStorage.setItem("dinner.householdName", "Charge");
  }, hid);
  await dad.reload();
  await expect(dad.locator(".tile")).toHaveCount(1);
  await dad.click("#whoBtn");
  await dad.click("#showAddName");
  await dad.fill("#personInput", "Dad");
  await dad.click("#personAdd");

  await dad.click("#whoBtn");
  await dad.click("#inviteBtn");
  await expect(dad.locator("#codeShow")).toHaveText(CODE_SHAPE);
  const code = (await dad.textContent("#codeShow")).replace("-", "");
  const join = await stored("households/" + hid + "/private/join");
  expect(join.fields.code.stringValue).toBe(code);
  expect((await stored("invites/" + code)).fields.hid.stringValue).toBe(hid);

  // Dad is still in, and a new phone can now join with the new code.
  await dad.click("#dlgCancel");
  await expect(dad.locator(".tile")).toHaveCount(1);
  const kid = await phone(browser);
  await joinWith(kid, code);
  await addMe(kid, "Kid");
  await expect(kid.locator(".tile")).toHaveCount(1);

  noErrors(dad, kid);
});
