// Dinner Decisions: Easy Mode, server side. ("plus" in the code and the
// database; Easy Mode is the name families see.)
//
// The page talks to Firestore directly for everything else. These functions
// exist for the two things a phone must not do itself: decide who has Easy Mode,
// and sign requests to Walmart with the private key.
//
// Every function checks that the caller's phone is a member of the family it
// names, as the security rules do, and the Walmart ones that the family has
// Easy Mode. Walmart calls are counted per family per day, so a family (or a
// stranger who joined one) cannot run through the shared API allowance.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { defineSecret, defineString } from "firebase-functions/params";
import { walmartClient, itemKey, DEFAULT_BASE } from "./walmart.js";

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "us-central1", maxInstances: 5 });

const WALMART_CONSUMER_ID = defineSecret("WALMART_CONSUMER_ID");
const WALMART_PRIVATE_KEY = defineSecret("WALMART_PRIVATE_KEY");
const WALMART_KEY_VERSION = defineString("WALMART_KEY_VERSION", { default: "1" });
const WALMART_BASE = defineString("WALMART_BASE", { default: DEFAULT_BASE });

const BETA_CAP = 10;            // families, unless config/plusBeta says otherwise
const DAILY_WALMART_CALLS = 300; // per family
const MAX_ITEMS = 60;
const PLUS = ["beta", "active"];

const today = () => new Date().toISOString().slice(0, 10);

async function member(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const hid = String((req.data && req.data.hid) || "");
  if (!/^[A-Za-z0-9]{1,40}$/.test(hid)) throw new HttpsError("invalid-argument", "No family given.");
  const m = await db.doc(`households/${hid}/members/${req.auth.uid}`).get();
  if (!m.exists) throw new HttpsError("permission-denied", "This phone is not in that family.");
  return hid;
}

async function plus(hid) {
  const p = await db.doc(`households/${hid}/billing/plan`).get();
  if (!p.exists || !PLUS.includes(p.get("status"))) {
    throw new HttpsError("failed-precondition", "Easy Mode is not on for this family.");
  }
}

// Counts n Walmart calls against the family's daily allowance, or refuses.
async function spend(hid, n) {
  if (!n) return;
  const ref = db.doc(`households/${hid}/private/usage`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    const used = d.day === today() ? Number(d.walmart) || 0 : 0;
    if (used + n > DAILY_WALMART_CALLS) {
      throw new HttpsError("resource-exhausted", "That is a lot of Walmart lookups for one day. Try again tomorrow.");
    }
    tx.set(ref, { day: today(), walmart: used + n });
  });
}

function walmart() {
  return walmartClient({
    base: WALMART_BASE.value(),
    consumerId: WALMART_CONSUMER_ID.value(),
    keyVersion: WALMART_KEY_VERSION.value(),
    privateKey: WALMART_PRIVATE_KEY.value()
  });
}

function unavailable(e) {
  logger.warn("walmart call failed", { status: e.status, message: String(e.message).slice(0, 300) });
  return new HttpsError("unavailable", "Walmart is not answering right now. Try again in a minute.");
}

/* ---------------- the beta ---------------- */

// A family turns the beta on from Manage. Spots are limited; config/plusBeta
// holds the cap and which families have one.
export const joinPlusBeta = onCall(async (req) => {
  const hid = await member(req);
  const planRef = db.doc(`households/${hid}/billing/plan`);
  const cfgRef = db.doc("config/plusBeta");
  return db.runTransaction(async (tx) => {
    const [plan, cfg] = await Promise.all([tx.get(planRef), tx.get(cfgRef)]);
    if (plan.exists && PLUS.includes(plan.get("status"))) return { status: plan.get("status") };
    const c = cfg.exists ? cfg.data() : {};
    const cap = Number.isInteger(c.cap) ? c.cap : BETA_CAP;
    const hids = Array.isArray(c.hids) ? c.hids : [];
    if (!hids.includes(hid) && hids.length >= cap) {
      throw new HttpsError("resource-exhausted", "The beta is full right now.");
    }
    tx.set(cfgRef, { cap, hids: hids.includes(hid) ? hids : hids.concat(hid) }, { merge: true });
    tx.set(planRef, { status: "beta", since: new Date().toISOString() });
    return { status: "beta" };
  });
});

export const leavePlusBeta = onCall(async (req) => {
  const hid = await member(req);
  await freeSpot(hid);
  return { status: "off" };
});

async function freeSpot(hid) {
  const planRef = db.doc(`households/${hid}/billing/plan`);
  const cfgRef = db.doc("config/plusBeta");
  await db.runTransaction(async (tx) => {
    const [plan, cfg] = await Promise.all([tx.get(planRef), tx.get(cfgRef)]);
    if (cfg.exists && Array.isArray(cfg.get("hids"))) {
      tx.update(cfgRef, { hids: cfg.get("hids").filter((h) => h !== hid) });
    }
    if (plan.exists && plan.get("status") === "beta") tx.delete(planRef);
  });
}

// A deleted family gives its beta spot back, and its server-only records go
// with it. The page deletes everything a phone can see.
export const familyDeleted = onDocumentDeleted("households/{hid}", async (event) => {
  const hid = event.params.hid;
  await freeSpot(hid);
  await db.doc(`households/${hid}/private/usage`).delete();
});

/* ---------------- Walmart ---------------- */

export const walmartStores = onCall({ secrets: [WALMART_CONSUMER_ID, WALMART_PRIVATE_KEY] }, async (req) => {
  const hid = await member(req);
  await plus(hid);
  const zip = String((req.data && req.data.zip) || "").trim();
  if (!/^\d{5}$/.test(zip)) throw new HttpsError("invalid-argument", "Type a 5-digit ZIP code.");
  await spend(hid, 1);
  try {
    return { stores: await walmart().stores(zip) };
  } catch (e) {
    throw unavailable(e);
  }
});

// For each item on the list: the product the family chose before, or the
// top Walmart matches. With refresh, items are searched again even when a
// product is remembered, which is how "Change" offers other choices.
export const walmartMatch = onCall({ secrets: [WALMART_CONSUMER_ID, WALMART_PRIVATE_KEY], timeoutSeconds: 120 }, async (req) => {
  const hid = await member(req);
  await plus(hid);
  const raw = Array.isArray(req.data && req.data.items) ? req.data.items : [];
  const refresh = !!(req.data && req.data.refresh);
  const seen = new Set();
  const items = [];
  for (const v of raw) {
    const name = String(v || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const key = itemKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    items.push({ name, key });
  }
  if (!items.length) throw new HttpsError("invalid-argument", "The list is empty.");
  if (items.length > MAX_ITEMS) throw new HttpsError("invalid-argument", `Up to ${MAX_ITEMS} items at a time.`);

  const remembered = {};
  if (!refresh) {
    const snaps = await db.getAll(...items.map((i) => db.doc(`households/${hid}/matches/${i.key}`)));
    snaps.forEach((s, n) => { if (s.exists) remembered[items[n].key] = s.data(); });
  }
  const toSearch = items.filter((i) => !remembered[i.key]);
  await spend(hid, toSearch.length);

  const client = toSearch.length ? walmart() : null;
  const found = {};
  let failures = 0;
  // A few at a time: quick for a long list, gentle on Walmart.
  for (let n = 0; n < toSearch.length; n += 4) {
    await Promise.all(toSearch.slice(n, n + 4).map(async (i) => {
      try {
        found[i.key] = await client.search(i.name, 5);
      } catch (e) {
        failures++;
        logger.warn("walmart search failed", { status: e.status });
        found[i.key] = [];
      }
    }));
  }
  if (toSearch.length && failures === toSearch.length) throw unavailable({ status: "all", message: "every search failed" });

  return {
    items: items.map((i) => {
      const r = remembered[i.key];
      return r
        ? { name: i.name, key: i.key, remembered: true, options: [{ itemId: String(r.itemId), name: String(r.name), price: typeof r.price === "number" ? r.price : null, image: String(r.image || "") }] }
        : { name: i.name, key: i.key, remembered: false, options: found[i.key] || [] };
    })
  };
});
