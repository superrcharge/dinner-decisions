// Copies exactly the files the website serves into dist/, which Firebase
// Hosting publishes. Nothing else in the repo goes out: not the tests, the
// tooling, the docs, or the local admin folder.
//
//   node scripts/build-site.mjs

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = "dist";
// A page is listed here only once it is finished and reviewed; a draft lying
// in the folder is never published by accident.
const PAGES = ["index.html", "privacy.html", "terms.html", "delete.html", "accessibility.html"];
// The legal pages carry review notes for the lawyer and for later work as
// HTML comments. They stay in the repo and are stripped from what is served.
const STRIP_COMMENTS = new Set(["privacy.html", "terms.html", "delete.html", "accessibility.html"]);

if (!existsSync("index.html")) throw new Error("run from the repo root");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT + "/icons", { recursive: true });

const copied = [];
for (const f of [...PAGES, "site.webmanifest"]) {
  if (!existsSync(f)) throw new Error("missing " + f);
  if (STRIP_COMMENTS.has(f)) {
    writeFileSync(OUT + "/" + f, readFileSync(f, "utf8").replace(/[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n?/g, ""));
  } else {
    cpSync(f, OUT + "/" + f);
  }
  copied.push(f);
}
for (const f of readdirSync("icons")) {
  if (f.endsWith(".png")) { cpSync("icons/" + f, OUT + "/icons/" + f); copied.push("icons/" + f); }
}
// The files that let invite links open the store apps (store/app-links.md).
// Each is written only once its value exists: the Apple Team ID after the
// Apple Developer account, the Play signing fingerprints after the Play
// Console account. Until then the links simply open the website.
const links = JSON.parse(readFileSync(process.env.APP_LINKS || "store/app-links.json", "utf8"));
const APP_ID = "app.dinnerdecisions";
if (links.appleTeamId || (links.androidCertSha256 || []).length) mkdirSync(OUT + "/.well-known", { recursive: true });
if (links.appleTeamId) {
  if (!/^[A-Z0-9]{10}$/.test(links.appleTeamId)) throw new Error("appleTeamId should be 10 letters and digits");
  writeFileSync(OUT + "/.well-known/apple-app-site-association", JSON.stringify({
    applinks: { details: [{ appIDs: [links.appleTeamId + "." + APP_ID], components: [{ "/": "/", "#": "join=*" }] }] }
  }, null, 2) + "\n");
  copied.push(".well-known/apple-app-site-association");
}
if ((links.androidCertSha256 || []).length) {
  for (const f of links.androidCertSha256) {
    if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)) throw new Error("not a SHA-256 fingerprint like AB:CD:...: " + f);
  }
  writeFileSync(OUT + "/.well-known/assetlinks.json", JSON.stringify([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: APP_ID, sha256_cert_fingerprints: links.androidCertSha256 }
  }], null, 2) + "\n");
  copied.push(".well-known/assetlinks.json");
}
console.log("dist/: " + copied.join(", "));
