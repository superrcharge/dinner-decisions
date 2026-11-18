// The store apps bundle the website's own files (scripts/build-app.mjs).
// This checks the bundle is the website plus only the two intended
// differences: Firebase served from inside the app, and Capacitor added.
//
//   node --test tests/app-build.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

execFileSync(process.execPath, ["scripts/build-app.mjs"], { stdio: "pipe" });
const site = readFileSync("dist/index.html", "utf8");
const app = readFileSync("www/index.html", "utf8");

test("the website's index.html is the repo's, untouched", () => {
  assert.equal(site, readFileSync("index.html", "utf8"));
});

test("the app loads Firebase from inside itself, never from gstatic", () => {
  assert.doesNotMatch(app, /gstatic\.com\/firebasejs/);
  for (const name of ["app", "auth", "firestore"]) {
    assert.match(app, new RegExp('<script src="vendor/firebase-' + name + '-compat\\.js"></script>'));
    assert.deepEqual(readFileSync("www/vendor/firebase-" + name + "-compat.js"),
      readFileSync("node_modules/firebase-web-compat/firebase-" + name + "-compat.js"));
  }
});

test("Capacitor's runtime loads first, before Firebase", () => {
  assert.ok(app.indexOf('src="vendor/capacitor.js"') > 0);
  assert.ok(app.indexOf('src="vendor/capacitor.js"') < app.indexOf('src="vendor/firebase-app-compat.js"'));
});

test("apart from those script tags, the app's page is the website's page", () => {
  const strip = (s) => s.split(/\r?\n/).filter((l) => !/<script src="/.test(l)).join("\n");
  assert.equal(strip(app), strip(site));
});

test("every page the website serves is in the app", () => {
  for (const f of readdirSync("dist")) assert.ok(readdirSync("www").includes(f), f);
});
