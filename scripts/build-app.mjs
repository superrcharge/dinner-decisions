// Builds www/, the web assets bundled inside the store apps, from exactly
// what the website serves (dist/, built by build-site.mjs). The apps carry
// the page with them instead of loading dinnerdecisions.app, which both
// stores ask for, and which lets the app open with no signal.
//
// Two differences from the website, both made here so index.html itself
// stays the same page everywhere:
//   - the three Firebase scripts the page loads from gstatic.com are copied
//     in from npm (byte-identical, same version), so they work offline;
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

cpSync("node_modules/@capacitor/core/dist/capacitor.js", OUT + "/vendor/capacitor.js");
html = html.replace('<script src="vendor/firebase-app-compat.js">',
  '<script src="vendor/capacitor.js"></script>\n<script src="vendor/firebase-app-compat.js">');

writeFileSync(OUT + "/index.html", html);
console.log("www/: dist/ plus vendor/capacitor.js and Firebase " + compat + " (" + FIREBASE.join(", ") + ")");
