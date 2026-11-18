// Walmart's affiliate product API: store lookup by ZIP and product search.
//
// Every request is signed with Dinner Decisions' private key, which is why
// this can only run on the server. Walmart checks the signature against the
// public key uploaded to the walmart.io dashboard.

import crypto from "node:crypto";

export const DEFAULT_BASE = "https://developer.api.walmart.com";
const PATH = "/api-proxy/service/affil/product/v2/";

export class WalmartError extends Error {
  constructor(status, body) {
    super(`Walmart answered ${status}: ${body}`);
    this.status = status;
  }
}

// A key pasted into Secret Manager by hand can arrive with its line breaks
// written out as "\n"; put them back.
export function pem(key) {
  return String(key || "").replace(/\\n/g, "\n").trim();
}

// Walmart signs "consumer id, timestamp, key version", each followed by a
// newline, with SHA-256 and the RSA private key.
export function signedHeaders({ consumerId, keyVersion, privateKey, now = Date.now() }) {
  const timestamp = String(now);
  const signature = crypto.createSign("RSA-SHA256")
    .update(`${consumerId}\n${timestamp}\n${keyVersion}\n`)
    .sign(pem(privateKey), "base64");
  return {
    "WM_CONSUMER.ID": consumerId,
    "WM_CONSUMER.INTIMESTAMP": timestamp,
    "WM_SEC.KEY_VERSION": String(keyVersion),
    "WM_SEC.AUTH_SIGNATURE": signature
  };
}

export function walmartClient({ base = DEFAULT_BASE, consumerId, keyVersion, privateKey, fetchImpl = fetch }) {
  async function get(endpoint, params) {
    const url = new URL(base.replace(/\/+$/, "") + PATH + endpoint);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const r = await fetchImpl(url, {
      headers: { ...signedHeaders({ consumerId, keyVersion, privateKey }), Accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new WalmartError(r.status, (await r.text()).slice(0, 300));
    return r.json();
  }

  return {
    async stores(zip) { return parseStores(await get("stores", { zip })); },
    async search(query, count = 5) { return parseItems(await get("search", { query, numItems: count })); }
  };
}

// Only what the app shows, checked and bounded, so nothing Walmart sends can
// reach a family's phone as anything but plain text.
export function parseStores(body) {
  const list = Array.isArray(body) ? body : (body && Array.isArray(body.stores) ? body.stores : []);
  return list.map((s) => ({
    id: String(s.no ?? s.storeId ?? ""),
    name: clip(s.name || "Walmart", 80),
    address: clip([s.streetAddress, s.city, s.stateProvCode].filter(Boolean).join(", "), 160),
    zip: String(s.zip || "").slice(0, 10)
  })).filter((s) => /^\d{1,10}$/.test(s.id)).slice(0, 6);
}

export function parseItems(body) {
  const list = body && Array.isArray(body.items) ? body.items : [];
  return list.map((it) => ({
    itemId: String(it.itemId ?? ""),
    name: clip(it.name, 200),
    price: typeof it.salePrice === "number" && isFinite(it.salePrice) ? Math.round(it.salePrice * 100) / 100 : null,
    image: safeImage(it.thumbnailImage || it.mediumImage)
  })).filter((i) => /^\d{1,15}$/.test(i.itemId) && i.name);
}

// Product photos come from Walmart's own image servers, over https, or not
// at all.
export function safeImage(url) {
  try {
    const u = new URL(String(url || ""));
    return u.protocol === "https:" && /(^|\.)walmartimages\.com$/.test(u.hostname) && u.href.length <= 500 ? u.href : "";
  } catch (e) {
    return "";
  }
}

function clip(v, max) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
}

// The document id a list item's remembered product is kept under. "Green
// onions" and "green onions" are the same item. The page never builds keys
// itself: walmartMatch hands each item's key back with its products.
export function itemKey(name) {
  const k = String(name || "").toLowerCase().normalize("NFKD")
    .replace(/\p{M}+/gu, "")          // accents: jalapeño -> jalapeno
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return k || "item-" + crypto.createHash("sha256").update(String(name || "")).digest("hex").slice(0, 16);
}
