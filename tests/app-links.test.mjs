// Invite links that open the store apps (store/app-links.md). The site
// build writes the two files Apple and Google check, once their values
// exist; the apps claim the same address. This checks both halves agree.
//
//   node --test tests/app-links.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FINGERPRINT = Array(32).fill("A1").join(":");
const dir = mkdtempSync(join(tmpdir(), "app-links-"));

function buildSite(links) {
  const env = { ...process.env };
  if (links) {
    env.APP_LINKS = join(dir, "links.json");
    writeFileSync(env.APP_LINKS, JSON.stringify(links));
  } else {
    delete env.APP_LINKS;
  }
  return execFileSync(process.execPath, ["scripts/build-site.mjs"], { env, stdio: "pipe", encoding: "utf8" });
}

test("with no IDs yet, the site serves no app-link files", () => {
  const repo = JSON.parse(readFileSync("store/app-links.json", "utf8"));
  buildSite(repo);
  assert.equal(existsSync("dist/.well-known/apple-app-site-association"), !!repo.appleTeamId);
  assert.equal(existsSync("dist/.well-known/assetlinks.json"), repo.androidCertSha256.length > 0);
});

test("with the IDs, the site serves both files for app.dinnerdecisions", () => {
  buildSite({ appleTeamId: "ABCDE12345", androidCertSha256: [FINGERPRINT] });
  const apple = JSON.parse(readFileSync("dist/.well-known/apple-app-site-association", "utf8"));
  assert.deepEqual(apple.applinks.details, [{ appIDs: ["ABCDE12345.app.dinnerdecisions"], components: [{ "/": "/", "#": "join=*" }] }]);
  const google = JSON.parse(readFileSync("dist/.well-known/assetlinks.json", "utf8"));
  assert.deepEqual(google, [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: "app.dinnerdecisions", sha256_cert_fingerprints: [FINGERPRINT] }
  }]);
  buildSite(null);
});

test("a mistyped Team ID or fingerprint stops the build", () => {
  assert.throws(() => buildSite({ appleTeamId: "abc", androidCertSha256: [] }), /appleTeamId/);
  assert.throws(() => buildSite({ appleTeamId: "", androidCertSha256: ["A1:B2"] }), /fingerprint/);
  buildSite(null);
});

test("Firebase Hosting serves the dot folder, and Apple's file as JSON", () => {
  const hosting = JSON.parse(readFileSync("firebase.json", "utf8")).hosting;
  assert.deepEqual(hosting.ignore, []);
  const rule = hosting.headers.find((h) => h.source === "/.well-known/apple-app-site-association");
  assert.deepEqual(rule.headers, [{ key: "Content-Type", value: "application/json" }]);
});

test("the Android app claims only the home page's address, verified", () => {
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  const filter = manifest.match(/<intent-filter android:autoVerify="true">[\s\S]*?<\/intent-filter>/);
  assert.ok(filter, "an autoVerify intent filter");
  assert.match(filter[0], /<data android:scheme="https" android:host="dinnerdecisions\.app" android:path="\/" \/>/);
  assert.match(filter[0], /android\.intent\.category\.BROWSABLE/);
});

test("the iPhone app claims dinnerdecisions.app and declares the age-range entitlement", () => {
  const ent = readFileSync("ios/App/App/App.entitlements", "utf8");
  assert.match(ent, /<string>applinks:dinnerdecisions\.app<\/string>/);
  assert.match(ent, /<key>com\.apple\.developer\.declared-age-range<\/key>\s*<true\/>/);
  const pbx = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
  assert.equal(pbx.split("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;").length - 1, 2);
});
