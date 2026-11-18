// Security rules, exercised against the local Firestore emulator.
// Run with `mise run rules-test`.
//
// The negative cases matter most. Each one is something a stranger, or a
// member of a different family, must never be able to do.

import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, writeBatch
} from "firebase/firestore";

const HID = "Abcdefghij0123456789";
const HID2 = "Zyxwvutsrq9876543210";
const CODE = "ABCDEFGHJK";
const CODE2 = "MNPQRSTUVW";
const NOW = "2026-11-16T12:00:00.000Z";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dinner-decisions",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8181
    }
  });
});

after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// The four documents the app writes when someone starts a family. `over`
// lets a test leave one out or bend one.
function startBatch(db, uid, hid = HID, code = CODE, over = {}) {
  const b = writeBatch(db);
  const parts = {
    house: { name: "Rivera", createdBy: uid, createdAt: NOW },
    join: { code },
    invite: { hid, createdAt: NOW },
    member: { code, joinedAt: NOW },
    ...over
  };
  if (parts.house) b.set(doc(db, "households", hid), parts.house);
  if (parts.join) b.set(doc(db, "households", hid, "private", "join"), parts.join);
  if (parts.invite) b.set(doc(db, "invites", over.inviteId || code), parts.invite);
  if (parts.member) b.set(doc(db, "households", hid, "members", uid), parts.member);
  return b.commit();
}

const join = (db, uid, hid = HID, code = CODE) =>
  setDoc(doc(db, "households", hid, "members", uid), { code, joinedAt: NOW });

// The household that predates self-serve: surname id, short code, and
// documents exactly as the earlier versions of the page wrote them.
async function seedLegacy() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "households", "charge"), { name: "Charge" });
    await setDoc(doc(db, "households", "charge", "private", "join"), { code: "pizza" });
    await setDoc(doc(db, "households", "charge", "members", "dad"), { code: "pizza", joinedAt: NOW });
    await setDoc(doc(db, "households", "charge", "meals", "tacos"), { name: "Tacos", active: true, createdAt: NOW });
    await setDoc(doc(db, "households", "charge", "people", "dad-ab12cd"), { name: "Dad", createdAt: NOW });
  });
}

/* ---------------- strangers ---------------- */

test("a signed-out visitor can read nothing", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(getDoc(doc(anon(), "invites", CODE)));
  await assertFails(getDoc(doc(anon(), "households", HID)));
});

test("a stranger cannot list households or invites", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(getDocs(collection(as("eve"), "households")));
  await assertFails(getDocs(collection(as("eve"), "invites")));
});

test("a stranger cannot read the invite code, the members, or any data", async () => {
  await startBatch(as("mom"), "mom");
  await setDoc(doc(as("mom"), "households", HID, "meals", "tacos"), { name: "Tacos" });
  const eve = as("eve");
  await assertFails(getDoc(doc(eve, "households", HID, "private", "join")));
  await assertFails(getDocs(collection(eve, "households", HID, "private")));
  await assertFails(getDoc(doc(eve, "households", HID, "members", "mom")));
  await assertFails(getDocs(collection(eve, "households", HID, "members")));
  for (const c of ["meals", "suggestions", "people", "votes", "weeks"]) {
    await assertFails(getDocs(collection(eve, "households", HID, c)));
  }
  await assertFails(setDoc(doc(eve, "households", HID, "meals", "x"), { name: "X" }));
  await assertFails(deleteDoc(doc(eve, "households", HID, "meals", "tacos")));
});

test("a stranger cannot join with a wrong code, or as someone else", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(join(as("eve"), "eve", HID, CODE2));
  await assertFails(join(as("eve"), "eve", HID, ""));
  await assertFails(join(as("eve"), "mallory", HID, CODE));
});

test("a stranger cannot delete a family, its code, its invite or its members", async () => {
  await startBatch(as("mom"), "mom");
  const eve = as("eve");
  await assertFails(deleteDoc(doc(eve, "households", HID)));
  await assertFails(deleteDoc(doc(eve, "households", HID, "private", "join")));
  await assertFails(deleteDoc(doc(eve, "invites", CODE)));
  await assertFails(deleteDoc(doc(eve, "households", HID, "members", "mom")));
});

test("nothing outside the known collections is reachable", async () => {
  await startBatch(as("mom"), "mom");
  const mom = as("mom");
  await assertFails(setDoc(doc(mom, "scratch", "x"), { a: 1 }));
  await assertFails(setDoc(doc(mom, "households", HID, "private", "plan"), { paid: true }));
  await assertFails(getDoc(doc(mom, "households", HID, "private", "plan")));
  await assertFails(setDoc(doc(mom, "households", HID, "other", "x"), { a: 1 }));
});

/* ---------------- starting a family ---------------- */

test("the full batch starts a family", async () => {
  await assertSucceeds(startBatch(as("mom"), "mom"));
  await assertSucceeds(getDoc(doc(as("mom"), "households", HID, "private", "join")));
});

test("a family cannot be started with a piece missing", async () => {
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { join: null }));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { invite: null }));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { member: null }));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { house: null }));
});

test("a family cannot be started with a weak code, a guessable id, or a bad name", async () => {
  await assertFails(startBatch(as("mom"), "mom", HID, "pizza"));
  await assertFails(startBatch(as("mom"), "mom", HID, "abcdefghjk"));
  await assertFails(startBatch(as("mom"), "mom", HID, "ABCDEFGH1O"));
  await assertFails(startBatch(as("mom"), "mom", "smith"));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { house: { name: "", createdBy: "mom", createdAt: NOW } }));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { house: { name: "x".repeat(41), createdBy: "mom", createdAt: NOW } }));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { house: { name: "Rivera", createdBy: "someone-else", createdAt: NOW } }));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { house: { name: "Rivera", createdBy: "mom", createdAt: NOW, junk: "x".repeat(1000) } }));
});

test("the invite must be the family's real code and point at that family", async () => {
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { inviteId: CODE2 }));
  await assertFails(startBatch(as("mom"), "mom", HID, CODE, { invite: { hid: HID2, createdAt: NOW } }));
});

test("a second family cannot take a code that is already in use", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(startBatch(as("eve"), "eve", HID2, CODE));
});

test("an existing family cannot be taken over by starting it again", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(startBatch(as("eve"), "eve", HID, CODE2));
  await assertFails(setDoc(doc(as("eve"), "households", HID, "private", "join"), { code: CODE2 }));
});

test("a stranger cannot point a new invite at someone else's family", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(setDoc(doc(as("eve"), "invites", CODE2), { hid: HID, createdAt: NOW }));
});

test("a family's name and creator cannot be edited afterwards", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(updateDoc(doc(as("mom"), "households", HID), { name: "Other" }));
});

/* ---------------- joining ---------------- */

test("the invite resolves to the family, and the right code admits a device", async () => {
  await startBatch(as("mom"), "mom");
  const kid = as("kid");
  const invite = await assertSucceeds(getDoc(doc(kid, "invites", CODE)));
  if (invite.data().hid !== HID) throw new Error("invite did not resolve");
  await assertSucceeds(getDoc(doc(kid, "households", HID)));
  await assertSucceeds(join(kid, "kid"));
  await assertSucceeds(getDocs(collection(kid, "households", HID, "meals")));
  await assertSucceeds(getDoc(doc(kid, "households", HID, "private", "join")));
});

test("a membership record cannot carry extra fields or be edited", async () => {
  await startBatch(as("mom"), "mom");
  const kid = as("kid");
  await assertFails(setDoc(doc(kid, "households", HID, "members", "kid"), { code: CODE, joinedAt: NOW, role: "owner" }));
  await join(kid, "kid");
  await assertFails(updateDoc(doc(kid, "households", HID, "members", "kid"), { code: CODE2 }));
});

/* ---------------- members ---------------- */

test("a member can leave, and then needs the code again", async () => {
  await startBatch(as("mom"), "mom");
  const kid = as("kid");
  await join(kid, "kid");
  await assertSucceeds(deleteDoc(doc(kid, "households", HID, "members", "kid")));
  await assertFails(getDocs(collection(kid, "households", HID, "meals")));
  await assertFails(join(kid, "kid", HID, CODE2));
  await assertSucceeds(join(kid, "kid"));
});

test("members can list and remove members; that is how a family is emptied", async () => {
  await startBatch(as("mom"), "mom");
  await join(as("kid"), "kid");
  await assertSucceeds(getDocs(collection(as("mom"), "households", HID, "members")));
  await assertSucceeds(deleteDoc(doc(as("mom"), "households", HID, "members", "kid")));
});

/* ---------------- changing the code ---------------- */

function rotate(db, hid, from, to, { withInvite = true, dropOld = true } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, "households", hid, "private", "join"), { code: to });
  if (withInvite) b.set(doc(db, "invites", to), { hid, createdAt: NOW });
  if (dropOld) b.delete(doc(db, "invites", from));
  return b.commit();
}

test("a member can change the code; the old one stops working", async () => {
  await startBatch(as("mom"), "mom");
  await assertSucceeds(rotate(as("mom"), HID, CODE, CODE2));
  await assertFails(join(as("kid"), "kid", HID, CODE));
  await assertSucceeds(join(as("kid"), "kid", HID, CODE2));
  const old = await getDoc(doc(as("kid"), "invites", CODE));
  if (old.exists()) throw new Error("old invite survived");
});

test("the code cannot be changed without its invite, to a weak one, or by a stranger", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(rotate(as("mom"), HID, CODE, CODE2, { withInvite: false }));
  await assertFails(rotate(as("mom"), HID, CODE, "pizza"));
  await assertFails(rotate(as("eve"), HID, CODE, CODE2));
});

test("the code cannot be deleted on its own", async () => {
  await startBatch(as("mom"), "mom");
  await assertFails(deleteDoc(doc(as("mom"), "households", HID, "private", "join")));
});

/* ---------------- deleting a family ---------------- */

test("a member can delete the family in one final batch", async () => {
  await startBatch(as("mom"), "mom");
  const mom = as("mom");
  await setDoc(doc(mom, "households", HID, "meals", "tacos"), { name: "Tacos" });
  await assertSucceeds(deleteDoc(doc(mom, "households", HID, "meals", "tacos")));

  const b = writeBatch(mom);
  b.delete(doc(mom, "invites", CODE));
  b.delete(doc(mom, "households", HID, "private", "join"));
  b.delete(doc(mom, "households", HID));
  b.delete(doc(mom, "households", HID, "members", "mom"));
  await assertSucceeds(b.commit());

  const gone = await getDoc(doc(mom, "households", HID));
  if (gone.exists()) throw new Error("household survived");
  const invite = await getDoc(doc(mom, "invites", CODE));
  if (invite.exists()) throw new Error("invite survived");
});

/* ---------------- the household that predates all this ---------------- */

test("a legacy member still reads, votes and edits", async () => {
  await seedLegacy();
  const dad = as("dad");
  await assertSucceeds(getDocs(collection(dad, "households", "charge", "meals")));
  await assertSucceeds(setDoc(doc(dad, "households", "charge", "votes", "2026-11-15__dad-ab12cd"), {
    weekId: "2026-11-15", personId: "dad-ab12cd", name: "Dad", mealIds: ["tacos"], updatedAt: NOW
  }));
  await assertSucceeds(updateDoc(doc(dad, "households", "charge", "meals", "tacos"), { name: "Fish Tacos" }));
  await assertSucceeds(updateDoc(doc(dad, "households", "charge", "meals", "tacos"), { icon: "\u{1F32E}" }));
  await assertSucceeds(updateDoc(doc(dad, "households", "charge", "meals", "tacos"), { ingredients: ["tortillas", "fish"] }));
  await assertSucceeds(setDoc(doc(dad, "households", "charge", "weeks", "2026-11-15"), { chosen: ["tacos"], updatedAt: NOW }));
});

test("the page that is live today can still join a legacy family", async () => {
  await seedLegacy();
  const kid = as("kid");
  await assertSucceeds(getDoc(doc(kid, "households", "charge")));
  await assertFails(join(kid, "kid", "charge", "burger"));
  await assertSucceeds(join(kid, "kid", "charge", "pizza"));
});

test("a legacy family moves to a strong code the first time it invites", async () => {
  await seedLegacy();
  await assertSucceeds(rotate(as("dad"), "charge", "pizza", CODE, { dropOld: false }));
  await assertFails(join(as("kid"), "kid", "charge", "pizza"));
  await assertSucceeds(join(as("kid"), "kid", "charge", CODE));
});

test("a short legacy code cannot be published as an invite", async () => {
  await seedLegacy();
  await assertFails(setDoc(doc(as("dad"), "invites", "pizza"), { hid: "charge", createdAt: NOW }));
});

/* ---------------- what a write may carry ---------------- */

async function family() {
  await startBatch(as("mom"), "mom");
  return as("mom");
}

test("meals: known fields only, bounded, and no markup in the icon", async () => {
  const mom = await family();
  const meal = (data) => setDoc(doc(mom, "households", HID, "meals", "m"), data);
  await assertSucceeds(meal({ name: "Tacos", active: true, createdAt: NOW, icon: "\u{1F32E}", ingredients: ["a", "b"] }));
  // A family emoji is one glyph and eleven code points.
  await assertSucceeds(meal({ name: "Tacos", icon: "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}" }));
  await assertFails(meal({ name: "Tacos", icon: "<img src=x onerror=alert(1)>" }));
  await assertFails(meal({ name: "Tacos", icon: "&lt;" }));
  await assertFails(meal({ name: "Tacos", icon: "x".repeat(65) }));
  await assertFails(meal({ name: "Tacos", icon: 7 }));
  await assertFails(meal({ name: "Tacos", junk: "x" }));
  await assertFails(meal({ name: "" }));
  await assertFails(meal({ name: "x".repeat(61) }));
  await assertFails(meal({ name: "Tacos", active: "yes" }));
  await assertFails(meal({ name: "Tacos", ingredients: Array(21).fill("a") }));
  await assertFails(meal({ name: "Tacos", ingredients: ["a", 7] }));
  await assertFails(meal({ name: "Tacos", ingredients: ["a", { b: 1 }] }));
  await assertFails(meal({ name: "Tacos", ingredients: ["x".repeat(1201)] }));
  await assertFails(meal({ name: "Tacos", ingredients: "a" }));
});

test("suggestions and people: known fields only, bounded", async () => {
  const mom = await family();
  const sug = (data) => setDoc(doc(mom, "households", HID, "suggestions", "s"), data);
  await assertSucceeds(sug({ name: "Ramen", addedBy: "", createdAt: NOW }));
  await assertFails(sug({ name: "Ramen", icon: "x" }));
  await assertFails(sug({ name: "x".repeat(61) }));
  await assertFails(sug({ name: "Ramen", addedBy: "x".repeat(25) }));

  const person = (data) => setDoc(doc(mom, "households", HID, "people", "p"), data);
  await assertSucceeds(person({ name: "Mom", createdAt: NOW }));
  await assertFails(person({ name: "x".repeat(25) }));
  await assertFails(person({ name: "Mom", admin: true }));
  await assertFails(person({ name: 7 }));
});

test("votes and weeks: known fields only, lists of strings", async () => {
  const mom = await family();
  const vote = (data) => setDoc(doc(mom, "households", HID, "votes", "v"), data);
  await assertSucceeds(vote({ weekId: "2026-11-15", personId: "mom-abc123", name: "Mom", mealIds: [], updatedAt: NOW }));
  await assertSucceeds(vote({ mealIds: ["tacos", "pizza"] }));
  await assertFails(vote({ mealIds: "tacos" }));
  await assertFails(vote({ mealIds: ["tacos", 7] }));
  await assertFails(vote({ mealIds: Array(201).fill("a") }));
  await assertFails(vote({ mealIds: [], junk: 1 }));
  await assertFails(vote({ weekId: "2026-11-15" }));

  const week = (data) => setDoc(doc(mom, "households", HID, "weeks", "2026-11-15"), data);
  await assertSucceeds(week({ chosen: ["tacos"], updatedAt: NOW }));
  await assertSucceeds(week({ chosen: [], updatedAt: NOW }));
  await assertFails(week({ chosen: "tacos" }));
  await assertFails(week({ chosen: [7] }));
  await assertFails(week({ chosen: [], junk: 1 }));
});

test("one family's member cannot touch another family", async () => {
  await startBatch(as("mom"), "mom");
  await startBatch(as("eve"), "eve", HID2, CODE2);
  const eve = as("eve");
  await assertFails(getDocs(collection(eve, "households", HID, "meals")));
  await assertFails(setDoc(doc(eve, "households", HID, "meals", "x"), { name: "X" }));
  await assertFails(deleteDoc(doc(eve, "invites", CODE)));
  await assertFails(rotate(eve, HID, CODE, "QRSTUVWXYZ"));
});

/* ---------------- Dinner Decisions Plus ---------------- */

const PLAN = ["households", HID, "billing", "plan"];
const STORE = { storeId: "1234", name: "Walmart Supercenter", address: "1550 Skibo Rd, Fayetteville, NC", zip: "28303", updatedAt: NOW };
const MATCH = { itemId: "10450114", name: "Great Value Whole Milk, 1 Gallon", price: 3.12, image: "https://i5.walmartimages.com/asr/milk.jpeg", updatedAt: NOW };

async function seedPlan(status = "beta") {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ...PLAN), { status, since: NOW });
  });
}

test("no phone can give its family Plus, or change it", async () => {
  await startBatch(as("mom"), "mom");
  const mom = as("mom");
  await assertFails(setDoc(doc(mom, ...PLAN), { status: "beta", since: NOW }));
  await seedPlan();
  await assertSucceeds(getDoc(doc(mom, ...PLAN)));
  await assertFails(updateDoc(doc(mom, ...PLAN), { status: "active" }));
  await assertFails(setDoc(doc(mom, "households", HID, "billing", "other"), { status: "active" }));
  // Only on the way out with the family.
  await assertFails(deleteDoc(doc(mom, ...PLAN)));
});

test("a stranger or another family cannot see or touch a family's Plus, store or remembered products", async () => {
  await startBatch(as("mom"), "mom");
  await startBatch(as("bob"), "bob", HID2, CODE2);
  await seedPlan();
  await assertSucceeds(setDoc(doc(as("mom"), "households", HID, "store", "walmart"), STORE));
  await assertSucceeds(setDoc(doc(as("mom"), "households", HID, "matches", "whole-milk"), MATCH));
  for (const who of ["eve", "bob"]) {
    const db = as(who);
    await assertFails(getDoc(doc(db, ...PLAN)));
    await assertFails(getDoc(doc(db, "households", HID, "store", "walmart")));
    await assertFails(getDocs(collection(db, "households", HID, "matches")));
    await assertFails(setDoc(doc(db, "households", HID, "store", "walmart"), STORE));
    await assertFails(setDoc(doc(db, "households", HID, "matches", "eggs"), MATCH));
    await assertFails(deleteDoc(doc(db, "households", HID, "matches", "whole-milk")));
  }
});

test("the store choice is checked field by field", async () => {
  await startBatch(as("mom"), "mom");
  const ref = doc(as("mom"), "households", HID, "store", "walmart");
  await assertSucceeds(setDoc(ref, STORE));
  await assertFails(setDoc(ref, { ...STORE, storeId: "12a4" }));
  await assertFails(setDoc(ref, { ...STORE, storeId: 1234 }));
  await assertFails(setDoc(ref, { ...STORE, name: "" }));
  await assertFails(setDoc(ref, { ...STORE, name: "x".repeat(81) }));
  await assertFails(setDoc(ref, { ...STORE, extra: "padding" }));
  await assertFails(setDoc(doc(as("mom"), "households", HID, "store", "kroger"), STORE));
  await assertSucceeds(deleteDoc(ref));
});

test("a remembered product is checked, and its photo can only come from Walmart over https", async () => {
  await startBatch(as("mom"), "mom");
  const db = as("mom");
  const ref = doc(db, "households", HID, "matches", "whole-milk");
  await assertSucceeds(setDoc(ref, MATCH));
  await assertSucceeds(setDoc(ref, { ...MATCH, price: null, image: "" }));
  await assertFails(setDoc(ref, { ...MATCH, image: "http://i5.walmartimages.com/a.jpg" }));
  await assertFails(setDoc(ref, { ...MATCH, image: "https://evil.example.com/a.jpg" }));
  await assertFails(setDoc(ref, { ...MATCH, image: "https://walmartimages.com.evil.net/a.jpg" }));
  await assertFails(setDoc(ref, { ...MATCH, image: 'https://i5.walmartimages.com/"onerror="x' }));
  await assertFails(setDoc(ref, { ...MATCH, itemId: "abc" }));
  await assertFails(setDoc(ref, { ...MATCH, price: "3.12" }));
  await assertFails(setDoc(ref, { ...MATCH, name: "" }));
  await assertFails(setDoc(ref, { ...MATCH, extra: 1 }));
  await assertFails(setDoc(doc(db, "households", HID, "matches", "Whole Milk"), MATCH));
  await assertSucceeds(deleteDoc(ref));
});

test("deleting the family takes its Plus record with it", async () => {
  await startBatch(as("mom"), "mom");
  await seedPlan();
  const mom = as("mom");
  const b = writeBatch(mom);
  b.delete(doc(mom, "invites", CODE));
  b.delete(doc(mom, "households", HID, "private", "join"));
  b.delete(doc(mom, ...PLAN));
  b.delete(doc(mom, "households", HID));
  b.delete(doc(mom, "households", HID, "members", "mom"));
  await assertSucceeds(b.commit());
});
