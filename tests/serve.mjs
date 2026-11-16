// A minimal static server for local testing: serves the repo root the way
// GitHub Pages serves the site, including an ETag so the page's update check
// behaves as it does live. Dev only.
//
//   node tests/serve.mjs [port]

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(process.cwd());
const port = Number(process.argv[2] || 5180);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "ETag": '"' + createHash("sha1").update(body).digest("hex").slice(0, 16) + '"',
      "Cache-Control": "no-cache"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log("serving " + root + " on http://127.0.0.1:" + port));
