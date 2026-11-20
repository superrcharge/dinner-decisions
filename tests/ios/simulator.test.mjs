// The real iPhone app in Apple's iOS Simulator (Mac only): built with
// --emulators, installed fresh, started, and watched from the outside. The
// page inside a WKWebView cannot be driven the way the Android test drives
// its WebView, so this checks what the simulator and the Firebase emulators
// can show: the app builds and starts, its bundle is the website plus only
// local files, and a fresh install signs in on its own within a few seconds,
// which is the step that used to stick inside iPhone apps.
//
//   mise run ios-test          (starts the emulators itself; a simulator must exist)

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";

const PKG = "app.dinnerdecisions";
const APP = "build/ios/Build/Products/Debug-iphonesimulator/App.app";
const SHOTS = "test-results/ios";
const AUTH = "http://127.0.0.1:9199";
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts });
const simctl = (...args) => sh("xcrun", ["simctl", ...args]);

let udid;

// Every anonymous account the auth emulator holds; a fresh install adds one.
async function accounts() {
  const r = await fetch(AUTH + "/identitytoolkit.googleapis.com/v1/projects/demo-dinner-decisions/accounts:batchGet?maxResults=500",
    { headers: { Authorization: "Bearer owner" } });
  return ((await r.json()).users || []).length;
}

before(() => {
  mkdirSync(SHOTS, { recursive: true });
  // Builds and launches; the launch is repeated below from a clean install.
  sh("bash", ["scripts/ios-sim.sh", "--emulators"], { stdio: "inherit" });
  udid = Object.values(JSON.parse(simctl("list", "devices", "booted", "-j")).devices).flat()
    .find((d) => /iPhone/.test(d.name))?.udid;
  assert.ok(udid, "a booted iPhone simulator");
});

after(() => { if (udid) try { simctl("terminate", udid, PKG); } catch (e) {} });

test("the bundle is the website plus Capacitor and the emulator hop, nothing from Google", () => {
  const pub = APP + "/public";
  for (const f of ["index.html", "emu.html", "vendor/capacitor.js", "vendor/firebase-auth-compat.js"]) {
    assert.ok(existsSync(pub + "/" + f), f + " is in the app");
  }
  const html = readFileSync(pub + "/index.html", "utf8");
  assert.doesNotMatch(html, /<script[^>]+src="https?:/, "no script loaded from the network");
  const config = JSON.parse(readFileSync(APP + "/capacitor.config.json", "utf8"));
  assert.equal(config.server?.appStartPath, "emu.html");
});

test("a fresh install starts and signs in within a few seconds", async () => {
  simctl("terminate", udid, PKG);
  simctl("uninstall", udid, PKG);
  const before = await accounts();
  simctl("install", udid, APP);
  const t0 = Date.now();
  simctl("launch", udid, PKG);
  let after = before;
  while (after <= before && Date.now() - t0 < 15000) {
    await new Promise((r) => setTimeout(r, 500));
    after = await accounts();
  }
  simctl("io", udid, "screenshot", SHOTS + "/fresh-install.png");
  assert.ok(after > before, "the app signed in (a new anonymous account) within 15 s; took " + (Date.now() - t0) + " ms");
});
