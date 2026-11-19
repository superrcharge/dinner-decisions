// The real Android app on a real (emulated) phone: the debug APK built with
// --emulators, installed fresh, driven through its WebView, talking to the
// Firebase emulators on this PC through `adb reverse`. Checks what only the
// native app can show: the bundled page and SDK, the native plugins, the
// share sheet, Android's print screen, haptics, invite links opening the
// app, the stores' age signals, the notification permission prompt, a
// notification actually posted, and the reminder's alarm set and cleared.
//
//   mise run android-test          (boots nothing: start the emulator first)

import { test, expect, _android as android } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PKG = "app.dinnerdecisions";
const APK = "build/DinnerDecisions-emulators-debug.apk";
const SHOTS = "test-results/android";
const SDK = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
const adb = (...args) => execFileSync(join(SDK, "platform-tools", "adb"), args, { encoding: "utf8" });

let device;

test.beforeAll(async () => {
  adb("start-server");
  [device] = await android.devices();
  expect(device, "an Android emulator or phone must be connected").toBeTruthy();
  mkdirSync(SHOTS, { recursive: true });
  adb("reverse", "tcp:8181", "tcp:8181");
  adb("reverse", "tcp:9199", "tcp:9199");
  // A fresh install each run; the first run has nothing to uninstall.
  try { adb("uninstall", PKG); } catch (e) {}
});

test.afterAll(async () => { if (device) await device.close(); });

// Starts the app, or with a link opens that link the way a tap in Messages
// does (no package named: Android picks who handles it).
async function launch(link) {
  if (link) adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-c", "android.intent.category.BROWSABLE", "-d", "'" + link + "'");
  else adb("shell", "am", "start", "-W", "-n", PKG + "/.MainActivity");
  // Playwright can still list the WebView of an app process that has since
  // been stopped or reinstalled, so wait for the one in the new process.
  const pid = Number(adb("shell", "pidof", PKG).trim());
  let webview;
  await expect.poll(() => (webview = device.webViews().find((w) => w.pkg() === PKG && w.pid() === pid)) && true,
    { message: "the app's WebView", timeout: 30000 }).toBe(true);
  const page = await webview.page();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return page;
}

// adb's own screencap: Playwright's device.screenshot() hangs on the emulator.
const shot = async (name) => writeFileSync(SHOTS + "/" + name + ".png",
  execFileSync(join(SDK, "platform-tools", "adb"), ["exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024 }));
// Taps a native control (here Android's own permission dialog) by its
// resource id, with adb alone, so no Playwright driver app goes on the phone.
async function tapNative(resourceId) {
  let bounds;
  await expect.poll(() => {
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
    const xml = adb("shell", "cat", "/sdcard/ui.xml");
    const node = xml.split("<node ").find((n) => n.includes('resource-id="' + resourceId + '"'));
    const m = node && node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    return !!(bounds = m && m.slice(1).map(Number));
  }, { message: "native control " + resourceId, timeout: 20000 }).toBe(true);
  adb("shell", "input", "tap", String((bounds[0] + bounds[2]) >> 1), String((bounds[1] + bounds[3]) >> 1));
}

// The window in front: the app, Android's share sheet, its print screen...
const focus = () => (adb("shell", "dumpsys", "window").split("\n").find((l) => l.includes("mCurrentFocus")) || "").trim();
async function backToApp() {
  await expect.poll(() => {
    if (!focus().includes(PKG)) adb("shell", "input", "keyevent", "KEYCODE_BACK");
    return focus();
  }, { message: "back in the app", timeout: 20000 }).toContain(PKG);
}
// Out to the home screen and back, as a person switching apps does.
async function awayAndBack() {
  adb("shell", "input", "keyevent", "KEYCODE_HOME");
  await expect.poll(focus, { message: "the home screen" }).not.toContain(PKG);
  adb("shell", "am", "start", "-W", "-n", PKG + "/.MainActivity");
  await expect.poll(focus, { message: "the app again" }).toContain(PKG);
}

// Pending alarms only ("Alarm{... app.dinnerdecisions}"); dumpsys also lists
// recently cancelled ones, which must not count.
const alarms = () => adb("shell", "dumpsys", "alarm").split("\n").filter((l) => /Alarm\{/.test(l) && l.includes(PKG));
// Vibrations the app has made, from Android's own recent history.
const buzzes = () => adb("shell", "dumpsys", "vibrator_manager").split("\n").filter((l) => l.includes("| " + PKG + " ")).length;

test("the Android app runs the bundled page, signs in, and its native features work", async () => {
  test.setTimeout(420000);
  adb("install", "-r", APK);
  const page = await launch();

  // The bundled page, inside the app, with the bundled Firebase SDK.
  await expect(page.locator("#barStatus")).toHaveText(/Not joined/i, { timeout: 60000 });
  expect(page.url()).toBe("https://localhost/index.html?emu=1");
  expect(await page.evaluate(() => window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform())).toBe("android");
  // Every script comes from inside the app: Firebase Auth's popup helper,
  // which would add Google's iframe script, is left out of the app's copy.
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
  expect(scripts).toEqual([
    "https://localhost/vendor/capacitor.js",
    "https://localhost/vendor/firebase-app-compat.js",
    "https://localhost/vendor/firebase-auth-compat.js",
    "https://localhost/vendor/firebase-firestore-compat.js",
    // Bundled but not started: reCAPTCHA cannot pass at the app's address,
    // so the apps skip it (no reCAPTCHA iframe, checked just below).
    "https://localhost/vendor/firebase-app-check-compat.js"
  ]);
  expect(await page.evaluate(() => document.querySelectorAll("iframe").length)).toBe(0);
  await shot("01-welcome");

  // Start a family.
  await page.click("#welcomeStart");
  await page.fill("#startFamily", "The Testers");
  await page.fill("#startName", "Ana");
  await page.click("#startGo");
  await expect(page.locator("#codeShow")).toHaveText(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
  const code = await page.textContent("#codeShow");
  const link = "https://dinnerdecisions.app/#join=" + code.replace("-", "");
  await expect(page.locator("#codeLink")).toHaveText(link);
  await shot("02-invite");

  // Share invite opens Android's own share sheet, not the clipboard.
  await expect(page.locator("#shareInvite")).toBeEnabled();
  await page.click("#shareInvite");
  await expect.poll(focus, { message: "Android's share sheet", timeout: 20000 }).toMatch(/intentresolver|ChooserActivity/);
  await new Promise((r) => setTimeout(r, 1500));
  await shot("03-share-sheet");
  await backToApp();
  await expect(page.locator("#shareInvite")).toHaveText("Share invite");
  await page.click("#dlgCancel");

  // Picking a dinner taps lightly under the finger.
  await page.click("#starterBtn");
  await expect(page.locator(".tile")).toHaveCount(16);
  const before = buzzes();
  const chili = page.locator(".tile", { has: page.locator(".tile-name", { hasText: /^Chili$/ }) });
  await chili.click();
  await expect(chili).toHaveAttribute("aria-pressed", "true");
  await expect.poll(buzzes, { message: "a vibration from the app" }).toBeGreaterThan(before);
  await shot("04-pick");

  // Print opens Android's print screen with the shopping list.
  const hid = await page.evaluate(() => localStorage.getItem("dinner.householdId"));
  await page.evaluate((hid) => firebase.firestore().doc("households/" + hid + "/meals/chili")
    .update({ ingredients: ["Ground beef", "Onion", "Kidney beans"] }), hid);
  await page.click("#tab-shop");
  await page.click('[data-plan="chili"]');
  await expect(page.locator(".buy-item")).toHaveCount(3);
  await page.click("#printBuy");
  await expect.poll(focus, { message: "Android's print screen", timeout: 20000 }).toContain("printspooler");
  await new Promise((r) => setTimeout(r, 5000)); // the preview renders
  await shot("05-print");
  await backToApp();
  await page.click("#tab-pick");

  // Vote reminders: Android asks for notification permission the first time.
  await page.click("#whoBtn");
  await expect(page.locator("#remindToggle")).toHaveText("Turn On");
  await shot("06-menu");
  await page.click("#remindToggle");
  await shot("07-permission");
  await tapNative("com.android.permissioncontroller:id/permission_allow_button");
  await expect(page.locator("#remindToggle")).toHaveText("Turn Off");
  await expect.poll(() => alarms().length, { message: "the weekly reminder's alarm" }).toBeGreaterThan(0);
  await shot("08-reminders-on");

  // A notification actually reaches the shade, with the app's own icon.
  await page.evaluate(() => window.Capacitor.registerPlugin("LocalNotifications").schedule({
    notifications: [{ id: 99, title: "Dinner Decisions", body: "Test reminder", isExactNotification: false, schedule: { at: new Date(Date.now() + 2000) } }]
  }));
  await expect.poll(() => adb("shell", "dumpsys", "notification", "--noredact"), { timeout: 90000 })
    .toMatch(new RegExp("pkg=" + PKG.replace(/\./g, "\\.") + "[\\s\\S]*Test reminder|Test reminder[\\s\\S]*pkg=" + PKG.replace(/\./g, "\\.")));
  adb("shell", "cmd", "statusbar", "expand-notifications");
  await new Promise((r) => setTimeout(r, 1500));
  await shot("09-notification");
  adb("shell", "cmd", "statusbar", "collapse");

  // The reminder survives a restart of the app.
  adb("shell", "am", "force-stop", PKG);
  const again = await launch();
  await expect(again.locator("#whoName")).toHaveText("Ana", { timeout: 60000 });
  await again.click("#whoBtn");
  await expect(again.locator("#remindToggle")).toHaveText("Turn Off");
  await again.locator("#sheetBackdrop").click({ position: { x: 10, y: 10 } });
  await expect(again.locator("#whoMenu")).toHaveCount(0);

  // Invite links open the app. Android trusts them once it has checked the
  // site's assetlinks.json, which goes live with the Play signing key
  // (store/app-links.md); until then the test approves the address the way
  // a person can under the app's "Open by default" settings.
  expect(adb("shell", "pm", "get-app-links", PKG)).toContain("dinnerdecisions.app");
  adb("shell", "pm", "set-app-links-user-selection", "--user", "0", "--package", PKG, "true", "dinnerdecisions.app");
  // While the app is open: the join dialog opens with the code.
  adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-c", "android.intent.category.BROWSABLE", "-d", "'" + link + "'");
  await expect(again.locator("#joinCode")).toHaveValue(code, { timeout: 20000 });
  expect(focus()).toContain(PKG);
  await again.click("#dlgCancel");
  // From cold: the link starts the app.
  adb("shell", "am", "force-stop", PKG);
  const linked = await launch(link);
  await expect(linked.locator("#joinCode")).toHaveValue(code, { timeout: 60000 });
  await shot("10-invite-link");
  await linked.click("#dlgCancel");
  // Any other page of the site stays in the browser.
  const other = adb("shell", "cmd", "package", "query-activities", "-a", "android.intent.action.VIEW",
    "-c", "android.intent.category.BROWSABLE", "-d", "https://dinnerdecisions.app/privacy.html");
  expect(other).not.toContain(PKG);

  // The stores' age signals, through Google Play's own test double (only a
  // debug build can switch it on). A parent's "no" holds the app; their
  // approval lets it go, checked again each time the app comes back.
  const age = (fn, arg) => linked.evaluate(([fn, arg]) => window.Capacitor.registerPlugin("AgeSignals")[fn](arg), [fn, arg]);
  await age("setUseFakeManager", { useFake: true });
  await age("setNextAgeSignalsAccessResult", { status: "SHARED" });
  await age("setNextAgeSignalsResult", { ageLower: 13, ageUpper: 15, ageRangeSource: "TIER_B", significantChangeStatus: "DECLINED" });
  await awayAndBack();
  await expect(linked.locator("#ageHoldNote")).toContainText("Google Play says a parent or guardian hasn’t approved", { timeout: 20000 });
  await expect(linked.locator("#ageHoldNote")).toBeVisible();
  await new Promise((r) => setTimeout(r, 1000)); // the screen repaints after resuming
  await shot("11-age-hold");
  await age("setNextAgeSignalsAccessResult", { status: "SHARED" });
  await age("setNextAgeSignalsResult", { ageLower: 13, ageUpper: 15, ageRangeSource: "TIER_B", significantChangeStatus: "APPROVED" });
  await awayAndBack();
  await expect(linked.locator("#ageHoldNote")).toHaveCount(0, { timeout: 20000 });
  await age("setUseFakeManager", { useFake: false });

  // Delete My Data clears the phone and the reminder.
  await linked.click("#whoBtn");
  await linked.click("#deleteMine");
  await shot("12-delete");
  await linked.click("#deleteMineGo");
  await expect(linked.locator("#banner .notice")).toHaveText("Your data was deleted from this phone.", { timeout: 30000 });
  await expect.poll(() => alarms().length, { message: "the reminder's alarm is cancelled" }).toBe(0);
  // The reload after deleting does not offer the launch link's invite again.
  await expect(linked.locator("#joinCode")).toHaveCount(0);
  await shot("13-deleted");

  for (const p of [page, again, linked]) expect(p.errors, "script errors in the app").toEqual([]);
});
