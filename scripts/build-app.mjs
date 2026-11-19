// Builds www/, the web assets bundled inside the store apps, from exactly
// what the website serves (dist/, built by build-site.mjs). The apps carry
// the page with them instead of loading dinnerdecisions.app, which both
// stores ask for, and which lets the app open with no signal.
//
// The differences from the website, all made here so index.html itself
// stays the same page everywhere:
//   - the three Firebase scripts the page loads from gstatic.com are copied
//     in from npm (same version), so they work offline; Auth's copy has its
//     popup sign-in helper removed (below);
//   - Capacitor's runtime is added, which is how the page learns it is
//     running inside the app and reaches the native plugins.
//
//   node scripts/build-app.mjs        then  npx cap sync

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = "www";
const FIREBASE = ["app", "auth", "firestore"];

if (!existsSync("index.html")) throw new Error("run from the repo root");
execFileSync(process.execPath, ["scripts/build-site.mjs"], { stdio: "inherit" });

rmSync(OUT, { recursive: true, force: true });
cpSync("dist", OUT, { recursive: true });
mkdirSync(OUT + "/vendor", { recursive: true });

const compat = JSON.parse(readFileSync("node_modules/firebase-web-compat/package.json", "utf8")).version;
let html = readFileSync(OUT + "/index.html", "utf8");

// The page names its Firebase version; the copy bundled here must be that
// same version, or the app would quietly run different code from the site.
for (const name of FIREBASE) {
  const tag = new RegExp('<script src="https://www\\.gstatic\\.com/firebasejs/([0-9.]+)/firebase-' + name + '-compat\\.js"></script>');
  const m = html.match(tag);
  if (!m) throw new Error("index.html no longer loads firebase-" + name + "-compat.js from gstatic");
  if (m[1] !== compat) {
    throw new Error("index.html loads Firebase " + m[1] + " but firebase-web-compat in package.json is " + compat +
      "; change package.json to npm:firebase@" + m[1]);
  }
  cpSync("node_modules/firebase-web-compat/firebase-" + name + "-compat.js", OUT + "/vendor/firebase-" + name + "-compat.js");
  html = html.replace(tag, '<script src="vendor/firebase-' + name + '-compat.js"></script>');
}

// Firebase Auth's compat SDK gives every page its popup and redirect sign-in
// helper, which on phones loads Google's iframe (apis.google.com) as soon as
// the page starts. The page only ever signs in anonymously, and inside an
// iPhone app that iframe is the known cause of slow or stuck sign-in, so the
// app's copy is built without the helper: the change Firebase recommends for
// Capacitor apps (initializeAuth with no popupRedirectResolver). The website
// keeps the stock file.
const AUTH = OUT + "/vendor/firebase-auth-compat.js";
const RESOLVER = /var (\w+)="undefined"!=typeof window\?\w+:void 0;(this\._delegate=\w+\.initialize\(\{options:\{persistence:)/g;
const auth = readFileSync(AUTH, "utf8");
const found = auth.match(RESOLVER) || [];
if (found.length !== 1) {
  throw new Error("firebase-auth-compat.js " + compat + ": expected one popup/redirect resolver to remove, found " + found.length);
}
writeFileSync(AUTH, auth.replace(RESOLVER, "var $1=void 0;$2"));

cpSync("node_modules/@capacitor/core/dist/capacitor.js", OUT + "/vendor/capacitor.js");
html = html.replace('<script src="vendor/firebase-app-compat.js">',
  '<script src="vendor/capacitor.js"></script>\n<script src="vendor/firebase-app-compat.js">');

writeFileSync(OUT + "/index.html", html);
console.log("www/: dist/ plus vendor/capacitor.js and Firebase " + compat + " (" + FIREBASE.join(", ") + ")");
