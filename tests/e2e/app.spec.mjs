// The page as it runs inside the store apps. A stand-in for Capacitor's
// native layer is put in place before the page loads: it says "native", and
// its LocalNotifications records every call (in localStorage, outside the
// page's own dinner.* keys, so it survives reloads and the delete wipe).
// The real plugin is exercised on a device; this checks the page's side.

import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith, noErrors } from "./helpers.mjs";

function fakeNative(permission) {
  const log = (kind, arg) => {
    const all = JSON.parse(localStorage.getItem("test.ln") || "[]");
    all.push([kind, arg]);
    localStorage.setItem("test.ln", JSON.stringify(all));
  };
  const ln = {
    requestPermissions: async () => { log("permission", permission); return { display: permission }; },
    schedule: async (o) => { log("schedule", o); return { notifications: [] }; },
    cancel: async (o) => { log("cancel", o); }
  };
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    isPluginAvailable: (n) => n === "LocalNotifications",
    registerPlugin: () => ln
  };
}

async function appPhone(browser, permission = "granted") {
  const page = await phone(browser, { url: "about:blank" });
  await page.context().addInitScript(fakeNative, permission);
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
  const ana = await appPhone(browser, "denied");
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
  // The next start, or the app going to the background, notices.
  await ben.reload();
  await expect(ben.locator(".welcome")).toBeVisible();
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
