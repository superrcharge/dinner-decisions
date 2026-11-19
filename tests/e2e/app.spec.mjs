// The page as it runs inside the store apps. A stand-in for Capacitor's
// native layer is put in place before the page loads: it says "native", and
// each plugin records every call (in localStorage, outside the page's own
// dinner.* keys, so it survives reloads and the delete wipe). The real
// plugins are exercised on a device (tests/android); this checks the page's
// side.

import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith, pick, noErrors } from "./helpers.mjs";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

function fakeNative(o) {
  const log = (kind, arg) => {
    const all = JSON.parse(localStorage.getItem("test.ln") || "[]");
    all.push([kind, arg === undefined ? null : arg]);
    localStorage.setItem("test.ln", JSON.stringify(all));
  };
  const fakes = {
    LocalNotifications: {
      requestPermissions: async () => { log("permission", o.permission); return { display: o.permission }; },
      schedule: async (x) => { log("schedule", x); return { notifications: [] }; },
      cancel: async (x) => { log("cancel", x); }
    },
    Share: { share: async (x) => { log("share", x); return {}; } },
    Haptics: { impact: async (x) => { log("haptic", x); } },
    Filesystem: {
      writeFile: async (x) => {
        log("file", { path: x.path, directory: x.directory, head: atob(x.data).slice(0, 9) });
        return { uri: "file:///cache/" + encodeURIComponent(x.path) };
      }
    },
    App: {
      addListener: async (name, fn) => { window.fakeAppEvents = window.fakeAppEvents || {}; window.fakeAppEvents[name] = fn; return { remove() {} }; },
      getLaunchUrl: async () => (o.launchUrl ? { url: o.launchUrl } : undefined)
    },
    AgeSignals: {
      requestAgeRange: async (x) => { log("ageAsk", x); return JSON.parse(localStorage.getItem("test.age") || '{"status":"NOT_SHARED"}'); },
      getRegulatoryRequirements: async () => { log("ageRules"); return { ageAssuranceRequired: !!o.ageRequired, regulatoryFeatures: [] }; }
    }
  };
  if (o.platform !== "ios") {
    fakes.Print = {
      print: async (x) => {
        log("print", { name: x.name, printing: document.body.classList.contains("printing"),
          items: [...document.querySelectorAll("#printSheet li span:first-child")].map((e) => e.textContent) });
      }
    };
  }
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => o.platform || "android",
    isPluginAvailable: (n) => n in fakes,
    registerPlugin: (n) => fakes[n]
  };
}

async function appPhone(browser, opts = {}) {
  const o = { permission: "granted", ...opts };
  const page = await phone(browser, { url: "about:blank", ...(o.platform === "ios" ? { userAgent: IPHONE_UA } : {}) });
  await page.context().addInitScript(fakeNative, o);
  await page.goto("/index.html?emu=1");
  await expect(page.locator("#barStatus")).toHaveText(/Not joined/i);
  return page;
}

const calls = (page, kind) => page.evaluate((k) =>
  JSON.parse(localStorage.getItem("test.ln") || "[]").filter((c) => c[0] === k).map((c) => c[1]), kind);

test("on the website there is no reminders switch and invites use the page's own address", async ({ browser }) => {
  const web = await phone(browser);
  const { link } = await startFamily(web, "The Riveras", "Ana");
  expect(link.startsWith("http://127.0.0.1:5180/index.html?emu=1#join=")).toBe(true);
  await web.click("#whoBtn");
  await expect(web.locator("#whoMenu")).toContainText("Delete My Data");
  await expect(web.locator("#remindToggle")).toHaveCount(0);
  await expect(web.locator("#whoMenu")).not.toContainText("Vote reminders");
  noErrors(web);
});

test("in the app, invites point at the website and vote reminders switch on and off", async ({ browser }) => {
  const ana = await appPhone(browser);
  const { code, link } = await startFamily(ana, "The Riveras", "Ana");
  // Another phone cannot open the app's own address, so the link is the site's.
  expect(link).toBe("https://dinnerdecisions.app/#join=" + code.replace("-", ""));

  await ana.click("#whoBtn");
  const toggle = ana.locator("#remindToggle");
  await expect(toggle).toHaveText("Turn On");
  await expect(ana.locator("#remindNote")).toHaveText("Sundays at 9 AM, on this phone.");

  await toggle.click();
  await expect(toggle).toHaveText("Turn Off");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(ana.locator("#remindNote")).toHaveText("Sundays at 9 AM, on this phone.");
  const scheduled = await calls(ana, "schedule");
  expect(scheduled).toHaveLength(1);
  const n = scheduled[0].notifications[0];
  expect(n.id).toBe(7001);
  expect(n.schedule.on).toEqual({ weekday: 1, hour: 9, minute: 0 });
  // No trip to Android's "Alarms & reminders" settings for a weekly nudge.
  expect(n.isExactNotification).toBe(false);
  expect(n.body).toContain("Pick the dinners");

  // Remembered across a restart.
  await ana.reload();
  await ana.click("#whoBtn");
  await expect(ana.locator("#remindToggle")).toHaveText("Turn Off");

  await ana.click("#remindToggle");
  await expect(ana.locator("#remindToggle")).toHaveText("Turn On");
  expect(await calls(ana, "cancel")).toEqual([{ notifications: [{ id: 7001 }] }]);
  expect(await ana.evaluate(() => localStorage.getItem("dinner.reminders"))).toBeNull();
  noErrors(ana);
});

test("in the app, a phone with notifications blocked says so and stays off", async ({ browser }) => {
  const ana = await appPhone(browser, { permission: "denied" });
  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#whoBtn");
  await ana.click("#remindToggle");
  await expect(ana.locator("#remindNote")).toHaveText("Notifications are turned off for Dinner Decisions in this phone’s settings.");
  await expect(ana.locator("#remindToggle")).toHaveText("Turn On");
  expect(await calls(ana, "schedule")).toEqual([]);
  noErrors(ana);
});

test("in the app, leaving the family or deleting my data stops the reminders", async ({ browser }) => {
  const ana = await appPhone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");

  const ben = await appPhone(browser);
  await joinWith(ben, code);
  await ben.click('#whoMenu [data-person]:has-text("Ana")');
  await ben.click("#whoBtn");
  await ben.click("#remindToggle");
  await expect(ben.locator("#remindToggle")).toHaveText("Turn Off");
  await ben.click("#leaveFamily");
  await ben.click("#leaveGo");
  await expect(ben.locator(".welcome")).toBeVisible();
  // Coming back to the app notices (and so would the next start).
  await ben.evaluate(() => window.fakeAppEvents.resume());
  await expect.poll(() => calls(ben, "cancel")).toEqual([{ notifications: [{ id: 7001 }] }]);

  await ana.click("#whoBtn");
  await ana.click("#remindToggle");
  await expect(ana.locator("#remindToggle")).toHaveText("Turn Off");
  await ana.click("#deleteMine");
  await ana.click("#deleteMineGo");
  await expect(ana.locator("#banner .notice")).toHaveText("Your data was deleted from this phone.");
  expect(await calls(ana, "cancel")).toEqual([{ notifications: [{ id: 7001 }] }]);
  expect(await ana.evaluate(() => localStorage.getItem("dinner.reminders"))).toBeNull();
  noErrors(ana, ben);
});

test("in the app, Share opens the phone's share sheet instead of copying", async ({ browser }) => {
  const ana = await appPhone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#tab-manage");
  await ana.click("#manageInvite");
  await ana.click("#shareInvite");
  await expect.poll(() => calls(ana, "share")).toEqual([{
    title: "Dinner Decisions",
    text: "Join The Riveras on Dinner Decisions to vote on this week’s dinners. Code: " + code,
    url: "https://dinnerdecisions.app/#join=" + code.replace("-", "")
  }]);
  // Nothing went to the clipboard fallback: the button never says Copied.
  await expect(ana.locator("#shareInvite")).toHaveText("Share invite");
  noErrors(ana);
});

// A planned dinner with ingredients, so the shopping list has something.
async function plannedList(page) {
  await page.click("#starterBtn");
  await expect(page.locator(".tile")).toHaveCount(16);
  const hid = await page.evaluate(() => localStorage.getItem("dinner.householdId"));
  await page.evaluate((hid) => firebase.firestore().doc("households/" + hid + "/meals/chili")
    .update({ ingredients: ["Ground beef", "Onion"] }), hid);
  await pick(page, "Chili");
  await page.click("#tab-shop");
  await page.click('[data-plan="chili"]');
  await expect(page.locator(".buy-item")).toHaveCount(2);
}

test("in the Android app, the plan shares and Print goes to Android's print screen", async ({ browser }) => {
  const ana = await appPhone(browser);
  await startFamily(ana, "The Riveras", "Ana");
  await plannedList(ana);
  await ana.evaluate(() => { window.printed = 0; window.print = () => { window.printed++; }; });

  await ana.click("#sharePlan");
  await expect.poll(async () => (await calls(ana, "share")).map((c) => c.text))
    .toEqual([expect.stringMatching(/^Dinners for the week of .*:\n1\. Chili$/)]);

  await ana.click("#printBuy");
  const week = await ana.evaluate(() => document.getElementById("weekLine").textContent);
  await expect.poll(() => calls(ana, "print"))
    .toEqual([{ name: "Shopping list - " + week, printing: true, items: ["Ground beef", "Onion"] }]);
  expect(await ana.evaluate(() => window.printed)).toBe(0);
  // The list is laid out for paper only when printing; the screen is as it was.
  await expect(ana.locator(".buy-item")).toHaveCount(2);
  await expect(ana.locator("#printSheet")).toBeHidden();
  noErrors(ana);
});

test("in the iPhone app, Print hands the share sheet the list as a PDF file", async ({ browser }) => {
  const ana = await appPhone(browser, { platform: "ios" });
  await startFamily(ana, "The Riveras", "Ana");
  await plannedList(ana);
  await ana.click("#printBuy");
  const week = await ana.evaluate(() => document.getElementById("weekLine").textContent.replace(/^Week of /i, ""));
  const name = "Shopping list " + week + ".pdf";
  await expect.poll(() => calls(ana, "share")).toEqual([{ files: ["file:///cache/" + encodeURIComponent(name)] }]);
  expect(await calls(ana, "file")).toEqual([{ path: name, directory: "CACHE", head: "%PDF-1.4\n" }]);
  noErrors(ana);
});

test("in the app, picking a dinner taps lightly under the finger", async ({ browser }) => {
  const ana = await appPhone(browser);
  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#starterBtn");
  await expect(ana.locator(".tile")).toHaveCount(16);
  await pick(ana, "Chili");
  await expect.poll(async () => (await calls(ana, "haptic")).length).toBeGreaterThan(0);
  expect((await calls(ana, "haptic"))[0]).toEqual({ style: "LIGHT" });
  noErrors(ana);
});

test("an invite link that opens the app offers to join, once", async ({ browser }) => {
  const ana = await phone(browser);
  const { code } = await startFamily(ana, "The Riveras", "Ana");
  const link = "https://dinnerdecisions.app/#join=" + code.replace("-", "");

  // Cold start: Android hands the link over as the launch URL.
  const ben = await appPhone(browser, { launchUrl: link });
  await expect(ben.locator("#joinCode")).toHaveValue(code);
  await ben.click("#joinGo");
  await expect(ben.locator("#whoMenu")).toContainText("Ana");
  // A reload in the same run (Delete My Data reloads) does not offer it again.
  await ben.reload();
  await expect(ben.locator("#barStatus")).not.toHaveText(/Connecting/i);
  await expect(ben.locator("#joinCode")).toHaveCount(0);

  // Warm: the link arrives as an event; the same tap reported twice opens once.
  const cy = await appPhone(browser);
  await cy.evaluate((url) => { window.fakeAppEvents.appUrlOpen({ url }); }, link);
  await expect(cy.locator("#joinCode")).toHaveValue(code);
  await cy.click("#dlgCancel");
  await cy.evaluate((url) => { window.fakeAppEvents.appUrlOpen({ url }); }, link);
  await expect(cy.locator("#joinCode")).toHaveCount(0);
  // A link without an invite just opens the app.
  await cy.evaluate(() => { window.fakeAppEvents.appUrlOpen({ url: "https://dinnerdecisions.app/" }); });
  await expect(cy.locator("#dialog")).toHaveCount(0);
  noErrors(ana, ben, cy);
});

test("in the Android app, a parent's no from Google Play holds the app until they approve", async ({ browser }) => {
  const ana = await appPhone(browser);
  // Asked once at start; no answer (or not a minor) changes nothing.
  await expect.poll(async () => (await calls(ana, "ageAsk")).length).toBe(1);
  await expect(ana.locator("#dialog")).toHaveCount(0);

  await ana.evaluate(() => localStorage.setItem("test.age", JSON.stringify({
    status: "SHARED", ageRange: { lowerBound: 13, upperBound: 15, ageRangeSource: "TIER_B" },
    significantChange: { status: "DECLINED" }
  })));
  // Coming back to the app asks again.
  await ana.evaluate(() => window.fakeAppEvents.resume());
  await expect(ana.locator("#dialog")).toContainText("Google Play says a parent or guardian hasn’t approved the latest version of Dinner Decisions");
  await ana.keyboard.press("Escape");
  await ana.locator("#sheetBackdrop").click({ position: { x: 5, y: 5 } });
  await expect(ana.locator("#ageHoldNote")).toBeVisible();
  // An invite link cannot open over it either.
  await ana.evaluate(() => { window.fakeAppEvents.appUrlOpen({ url: "https://dinnerdecisions.app/#join=ABCDE23456" }); });
  await expect(ana.locator("#ageHoldNote")).toBeVisible();

  await ana.evaluate(() => localStorage.setItem("test.age", JSON.stringify({
    status: "SHARED", ageRange: { lowerBound: 13, upperBound: 15 }, significantChange: { status: "APPROVED" }
  })));
  await ana.evaluate(() => window.fakeAppEvents.resume());
  await expect(ana.locator("#dialog")).toHaveCount(0);
  // Nothing about age is kept on the phone.
  expect(await ana.evaluate(() => Object.keys(localStorage).filter((k) => /^dinner\./.test(k) && /age/i.test(k)))).toEqual([]);
  noErrors(ana);
});

test("in the iPhone app, Apple is asked for an age range only where the law requires it", async ({ browser }) => {
  const free = await appPhone(browser, { platform: "ios" });
  await expect.poll(async () => (await calls(free, "ageRules")).length).toBe(1);
  expect(await calls(free, "ageAsk")).toEqual([]);

  const gated = await appPhone(browser, { platform: "ios", ageRequired: true });
  await expect.poll(() => calls(gated, "ageAsk")).toEqual([{ ageGates: [13, 16, 18] }]);
  await expect(gated.locator("#dialog")).toHaveCount(0);
  noErrors(free, gated);
});
