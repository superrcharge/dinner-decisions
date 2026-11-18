import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { signedHeaders, walmartClient, parseStores, parseItems, safeImage, itemKey, pem, WalmartError } from "../walmart.js";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

test("the signature is what Walmart checks: consumer id, timestamp and key version, signed with the private key", () => {
  const h = signedHeaders({ consumerId: "abc-123", keyVersion: 1, privateKey, now: 1763400000000 });
  assert.equal(h["WM_CONSUMER.ID"], "abc-123");
  assert.equal(h["WM_CONSUMER.INTIMESTAMP"], "1763400000000");
  assert.equal(h["WM_SEC.KEY_VERSION"], "1");
  const ok = crypto.createVerify("RSA-SHA256").update("abc-123\n1763400000000\n1\n").verify(publicKey, h["WM_SEC.AUTH_SIGNATURE"], "base64");
  assert.ok(ok);
});

test("a key pasted with its line breaks written out still signs", () => {
  const flat = privateKey.replace(/\n/g, "\\n");
  assert.equal(pem(flat), privateKey.trim());
  assert.doesNotThrow(() => signedHeaders({ consumerId: "x", keyVersion: 1, privateKey: flat }));
});

test("stores and products keep only checked, bounded fields", () => {
  const stores = parseStores([
    { no: 1234, name: "Fayetteville Supercenter", streetAddress: "1550 Skibo Rd", city: "Fayetteville", stateProvCode: "NC", zip: "28303" },
    { no: "<script>", name: "bad" },
    { name: "no number" }
  ]);
  assert.deepEqual(stores, [{ id: "1234", name: "Fayetteville Supercenter", address: "1550 Skibo Rd, Fayetteville, NC", zip: "28303" }]);

  const items = parseItems({ items: [
    { itemId: 10450114, name: "Great Value Whole Milk, 1 Gallon", salePrice: 3.12, thumbnailImage: "https://i5.walmartimages.com/asr/milk.jpeg" },
    { itemId: 55, name: "Tracker", salePrice: 1, thumbnailImage: "https://evil.example.com/x.png" },
    { itemId: "abc", name: "No id" },
    { itemId: 77, name: "" }
  ] });
  assert.deepEqual(items, [
    { itemId: "10450114", name: "Great Value Whole Milk, 1 Gallon", price: 3.12, image: "https://i5.walmartimages.com/asr/milk.jpeg" },
    { itemId: "55", name: "Tracker", price: 1, image: "" }
  ]);
  assert.deepEqual(parseItems(null), []);
  assert.deepEqual(parseStores({ stores: "nope" }), []);
});

test("only https photos from Walmart's image servers are passed on", () => {
  assert.equal(safeImage("https://i5.walmartimages.com/a.jpg"), "https://i5.walmartimages.com/a.jpg");
  assert.equal(safeImage("http://i5.walmartimages.com/a.jpg"), "");
  assert.equal(safeImage("https://walmartimages.com.evil.net/a.jpg"), "");
  assert.equal(safeImage("javascript:alert(1)"), "");
  assert.equal(safeImage(undefined), "");
});

test("the same item always gets the same key, whatever its capitals and spacing", () => {
  assert.equal(itemKey("Green Onions"), "green-onions");
  assert.equal(itemKey("  green   onions "), "green-onions");
  assert.equal(itemKey("Jalapeño"), "jalapeno");
  assert.match(itemKey("🍕"), /^item-[0-9a-f]{16}$/);
  assert.equal(itemKey("x".repeat(300)).length, 100);
});

test("the client signs each request and calls the affiliate paths", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers });
    if (String(url).includes("/stores")) return new Response(JSON.stringify([{ no: 9, name: "Store" }]));
    return new Response(JSON.stringify({ items: [{ itemId: 1, name: "Milk", salePrice: 2 }] }));
  };
  const c = walmartClient({ base: "https://example.test/", consumerId: "id", keyVersion: 2, privateKey, fetchImpl });
  assert.deepEqual(await c.stores("28303"), [{ id: "9", name: "Store", address: "", zip: "" }]);
  assert.deepEqual(await c.search("whole milk", 3), [{ itemId: "1", name: "Milk", price: 2, image: "" }]);
  assert.equal(calls[0].url, "https://example.test/api-proxy/service/affil/product/v2/stores?zip=28303");
  assert.equal(calls[1].url, "https://example.test/api-proxy/service/affil/product/v2/search?query=whole+milk&numItems=3");
  assert.equal(calls[1].headers["WM_SEC.KEY_VERSION"], "2");
});

test("a Walmart error carries its status", async () => {
  const c = walmartClient({ base: "https://example.test", consumerId: "id", keyVersion: 1, privateKey, fetchImpl: async () => new Response("denied", { status: 401 }) });
  await assert.rejects(c.search("milk"), (e) => e instanceof WalmartError && e.status === 401);
});
