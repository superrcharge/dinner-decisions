// The real Android app on a real (emulated) phone: the debug APK built with
// --emulators, installed fresh, driven through its WebView, talking to the
// Firebase emulators on this PC through `adb reverse`. Checks what only the
// native app can show: the bundled page and SDK, the native plugins, the
// notification permission prompt, a notification actually posted, and the
// reminder's alarm set and cleared.
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

async function launch() {
  adb("shell", "am", "start", "-W", "-n", PKG + "/.MainActivity");
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

// Pending alarms only ("Alarm{... app.dinnerdecisions}"); dumpsys also lists
// recently cancelled ones, which must not count.
const alarms = () => adb("shell", "dumpsys", "alarm").split("\n").filter((l) => /Alarm\{/.test(l) && l.includes(PKG));

test("the Android app runs the bundled page, signs in, and its native features work", async () => {
  test.setTimeout(240000);
  adb("install", "-r", APK);
  const page = await launch();

  // The bundled page, inside the app, with the bundled Firebase SDK.
  await expect(page.locator("#barStatus")).toHaveText(/Not joined/i, { timeout: 60000 });
  expect(page.url()).toBe("https://localhost/index.html?emu=1");
  expect(await page.evaluate(() => window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform())).toBe("android");
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
  expect(scripts.filter((s) => s.startsWith("https://localhost/"))).toEqual([
    "https://localhost/vendor/capacitor.js",
    "https://localhost/vendor/firebase-app-compat.js",
    "https://localhost/vendor/firebase-auth-compat.js",
    "https://localhost/vendor/firebase-firestore-compat.js"
  ]);
  // Firebase Auth's compat SDK adds Google's iframe helper (apis.google.com)
  // by itself on phones, for sign-in methods this app never uses. Nothing
  // else may come from outside the app.
  expect(scripts.filter((s) => !s.startsWith("https://localhost/") && !s.startsWith("https://apis.google.com/"))).toEqual([]);
  await shot("1-welcome");

  // Start a family.
  await page.click("#welcomeStart");
  await page.fill("#startFamily", "The Testers");
  await page.fill("#startName", "Ana");
  await page.click("#startGo");
  await expect(page.locator("#codeShow")).toHaveText(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
  const code = (await page.textContent("#codeShow")).replace("-", "");
  await expect(page.locator("#codeLink")).toHaveText("https://dinnerdecisions.app/#join=" + code);
  await shot("2-invite");
  await page.click("#dlgCancel");
  await page.click("#starterBtn");
  await expect(page.locator(".tile")).toHaveCount(16);
  await page.locator(".tile").first().click();
  await expect(page.locator(".tile").first()).toHaveAttribute("aria-pressed", "true");
  await shot("3-pick");

  // Vote reminders: Android asks for notification permission the first time.
  await page.click("#whoBtn");
  await expect(page.locator("#remindToggle")).toHaveText("Turn On");
  await shot("4-menu");
  await page.click("#remindToggle");
  await shot("5-permission");
  await tapNative("com.android.permissioncontroller:id/permission_allow_button");
  await expect(page.locator("#remindToggle")).toHaveText("Turn Off");
  await expect.poll(() => alarms().length, { message: "the weekly reminder's alarm" }).toBeGreaterThan(0);
  await shot("6-reminders-on");

  // A notification actually reaches the shade, with the app's own icon.
  await page.evaluate(() => window.Capacitor.registerPlugin("LocalNotifications").schedule({
    notifications: [{ id: 99, title: "Dinner Decisions", body: "Test reminder", isExactNotification: false, schedule: { at: new Date(Date.now() + 2000) } }]
  }));
  await expect.poll(() => adb("shell", "dumpsys", "notification", "--noredact"), { timeout: 90000 })
    .toMatch(new RegExp("pkg=" + PKG.replace(/\./g, "\\.") + "[\\s\\S]*Test reminder|Test reminder[\\s\\S]*pkg=" + PKG.replace(/\./g, "\\.")));
  adb("shell", "cmd", "statusbar", "expand-notifications");
  await new Promise((r) => setTimeout(r, 1500));
  await shot("7-notification");
  adb("shell", "cmd", "statusbar", "collapse");

  // The reminder survives a restart of the app.
  adb("shell", "am", "force-stop", PKG);
  const again = await launch();
  await expect(again.locator("#whoName")).toHaveText("Ana", { timeout: 60000 });
  await again.click("#whoBtn");
  await expect(again.locator("#remindToggle")).toHaveText("Turn Off");

  // Delete My Data clears the phone and the reminder.
  await again.click("#deleteMine");
  await shot("8-delete");
  await again.click("#deleteMineGo");
  await expect(again.locator("#banner .notice")).toHaveText("Your data was deleted from this phone.", { timeout: 30000 });
  await expect.poll(() => alarms().length, { message: "the reminder's alarm is cancelled" }).toBe(0);
  await shot("9-deleted");

  expect(again.errors, "script errors in the app").toEqual([]);
  expect(page.errors, "script errors in the app").toEqual([]);
});
