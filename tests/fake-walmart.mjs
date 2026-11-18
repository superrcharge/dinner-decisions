// A pretend Walmart affiliate API for the browser tests, so they never touch
// the real one. It checks every request's signature against the test key's
// public half, as Walmart does, and answers from a small made-up catalog.
//
//   node tests/fake-walmart.mjs [port]
//
// GET /_calls returns how many searches it has answered, and
// POST /_calls resets the count, so a test can tell a remembered product
// (no search) from a fresh one.

import { createServer } from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const port = Number(process.argv[2] || 5199);
// Written by scripts/test-walmart-keys.mjs before the emulators start.
const publicKey = () => fs.readFileSync(path.join(os.tmpdir(), "dinner-decisions-fake-walmart.pem"), "utf8");
let searches = 0;

const STORES = [
  { no: 1234, name: "Walmart Supercenter", streetAddress: "1550 Skibo Rd", city: "Fayetteville", stateProvCode: "NC", zip: "28303" },
  { no: 5678, name: "Walmart Neighborhood Market", streetAddress: "3800 Raeford Rd", city: "Fayetteville", stateProvCode: "NC", zip: "28304" },
  { no: 9012, name: "Walmart Supercenter", streetAddress: "7701 S Raeford Rd", city: "Fayetteville", stateProvCode: "NC", zip: "28304" }
];

// Three products per query, with ids fixed by the query text.
function catalog(query) {
  if (/unobtainium/i.test(query)) return [];
  const base = parseInt(crypto.createHash("sha256").update(query.toLowerCase()).digest("hex").slice(0, 7), 16);
  const title = query.replace(/\b\w/g, (c) => c.toUpperCase());
  return [
    { itemId: base, name: `Great Value ${title}`, salePrice: 2.48, thumbnailImage: `https://i5.walmartimages.com/fake/${base}.jpeg` },
    { itemId: base + 1, name: `Marketside ${title}, Family Size`, salePrice: 4.97, thumbnailImage: `https://i5.walmartimages.com/fake/${base + 1}.jpeg` },
    { itemId: base + 2, name: `${title}, Organic`, salePrice: 6.12, thumbnailImage: `https://i5.walmartimages.com/fake/${base + 2}.jpeg` }
  ];
}

function signed(req) {
  const id = req.headers["wm_consumer.id"], ts = req.headers["wm_consumer.intimestamp"];
  const ver = req.headers["wm_sec.key_version"], sig = req.headers["wm_sec.auth_signature"];
  if (!id || !ts || !ver || !sig) return false;
  try {
    return crypto.createVerify("RSA-SHA256").update(`${id}\n${ts}\n${ver}\n`).verify(publicKey(), sig, "base64");
  } catch (e) {
    return false;
  }
}

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const json = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (url.pathname === "/_calls") {
    if (req.method === "POST") searches = 0;
    return json(200, { searches });
  }
  if (!signed(req)) return json(401, { errors: [{ code: 401, message: "bad signature" }] });
  if (url.pathname.endsWith("/affil/product/v2/stores")) {
    return json(200, url.searchParams.get("zip") === "00000" ? [] : STORES);
  }
  if (url.pathname.endsWith("/affil/product/v2/search")) {
    searches++;
    const q = url.searchParams.get("query") || "";
    const items = catalog(q).slice(0, Number(url.searchParams.get("numItems") || 5));
    return json(200, { query: q, totalResults: items.length, items });
  }
  json(404, { errors: [{ code: 404 }] });
}).listen(port, "127.0.0.1");
