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
for (const f of [...PAGES, "site.webmanifest", "robots.txt", "sitemap.xml"]) {
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
console.log("dist/: " + copied.join(", "));
