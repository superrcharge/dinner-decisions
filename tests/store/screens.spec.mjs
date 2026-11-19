// Store screenshots and the Play feature graphic, made from the app itself.
//
// A sample family with no real names is built on the local Firebase
// emulators, the way a person would build it (start a family, add starter
// meals, everyone votes, plan the week, add ingredients). Each screen is
// photographed at the size its store asks for, then set on the app's green
// with its caption from store/listing.md.
//
//   mise run store-screenshots        writes store/screenshots/ and store/graphics/
//
// The page runs with a stand-in for the app's native layer, as in
// tests/e2e/app.spec.mjs, so it looks the way it does inside the apps:
// invite links point at dinnerdecisions.app and Vote reminders shows.

import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { startFamily, pick } from "../e2e/helpers.mjs";

const OUT = "store/screenshots";
const GREEN = "#176B4B";

// Each store's canvas, and the width in CSS pixels of the screen drawn in it
// (a phone or a tablet). The screen's height and pixel density follow from
// the room left under the caption.
const SETS = [
  { key: "play-phone", w: 1080, h: 1920, css: 390 },
  { key: "play-tablet-7in", w: 1080, h: 1920, css: 600 },
  { key: "play-tablet-10in", w: 1440, h: 2560, css: 800 },
  { key: "apple-iphone-6.9in", w: 1320, h: 2868, css: 430 }
];

const SHOTS = [
  { file: "1-pick", caption: "Everyone taps the dinners they’d like" },
  { file: "2-results", caption: "See what won, and who picked it" },
  { file: "3-grocery-list", caption: "One grocery list for the week" },
  { file: "4-invite", caption: "Invite the house with a link or a code" },
  { file: "5-manage", caption: "Your meal list, behind its own code" },
  { file: "6-reminders", caption: "A weekly reminder, only if you want one" }
];

// The meals are listed A to Z, so the votes lean on the first ones, which
// are the tiles a screenshot shows.
const PEOPLE = {
  Sam: ["Burgers", "Baked Salmon", "Tacos", "Chili"],
  Alex: ["Burgers", "BBQ Chicken", "Tacos"],
  Jordan: ["Burgers", "Baked Salmon", "Fajitas", "Tacos"],
  Riley: ["Burgers", "Breakfast for Dinner", "Pizza"]
};
const SUGGESTION = { by: "Riley", meal: "Shrimp Scampi" };
const PLAN = ["Burgers", "Tacos", "Baked Salmon"];
const INGREDIENTS = {
  Burgers: ["Ground beef", "Burger buns", "Cheddar slices", "Lettuce", "Tomatoes"],
  Tacos: ["Tortillas", "Ground beef", "Shredded cheese", "Salsa"],
  "Baked Salmon": ["Salmon fillets", "Lemons", "Asparagus", "Rice"]
};

function fakeNative() {
  const ln = {
    requestPermissions: async () => ({ display: "granted" }),
    schedule: async () => ({ notifications: [] }),
    cancel: async () => {}
  };
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    isPluginAvailable: (n) => n === "LocalNotifications",
    registerPlugin: () => ln
  };
}

// Meal icons are emoji, drawn by the phone's own emoji font. Chromium on
// Windows would draw Microsoft's, which no Android phone or iPhone shows, so
// the Play sets use Google's Noto Color Emoji (what Android draws, and openly
// licensed). The iPhone set is drawn with Apple's emoji when this runs on a
// Mac; elsewhere it falls back to Noto too.
function emojiOverride(set) {
  return set.key.startsWith("apple") && process.platform === "darwin" ? null : "Noto Color Emoji";
}

async function useEmojiFont(page, font) {
  await page.addStyleTag({ url: "https://fonts.googleapis.com/css2?family=" + font.replace(/ /g, "+") + "&display=block" });
  await page.addStyleTag({ content: `
    :root {
      --display: "Fraunces", "${font}", Georgia, serif;
      --body: "Public Sans", "${font}", -apple-system, "Segoe UI", Roboto, sans-serif;
      --mono: "DM Mono", "${font}", ui-monospace, Consolas, monospace;
    }
    .tile-icon { font-family: "${font}", sans-serif !important; }` });
}

function layout(set) {
  const captionH = Math.round(set.h * 0.16);
  const bottom = Math.round(set.h * 0.035);
  const frameW = Math.round(set.w * 0.84);
  const frameH = set.h - captionH - bottom;
  return { captionH, frameW, frameH, dpr: frameW / set.css, cssH: Math.round(set.css * frameH / frameW) };
}

async function mealId(page, name) {
  return page.evaluate((n) => {
    const t = [...document.querySelectorAll(".tile")].find((x) => x.querySelector(".tile-name").textContent.trim() === n);
    return t && t.dataset.meal;
  }, name);
}

async function as(page, name) {
  await page.click("#whoBtn");
  await page.click(`#whoMenu [data-person]:has-text("${name}")`);
  await expect(page.locator("#whoName")).toHaveText(name);
}

// The sample family, built through the app.
async function buildFamily(page) {
  await startFamily(page, "The Parkers", "Sam");
  await page.click("#starterBtn");
  await expect(page.locator(".tile")).toHaveCount(16);
  for (const name of ["Alex", "Jordan", "Riley"]) {
    await page.click("#whoBtn");
    await page.click("#showAddName");
    await page.fill("#personInput", name);
    await page.click("#personAdd");
    await expect(page.locator("#whoName")).toHaveText(name);
  }
  for (const [name, picks] of Object.entries(PEOPLE).reverse()) {
    await as(page, name);
    for (const meal of picks) await pick(page, meal);
    if (name === SUGGESTION.by) {
      await page.fill("#addInput", SUGGESTION.meal);
      await page.click("#addBtn");
      await expect(page.locator(".tile-name", { hasText: SUGGESTION.meal })).toBeVisible();
    }
  }
  const hid = await page.evaluate(() => localStorage.getItem("dinner.householdId"));
  for (const [meal, ingredients] of Object.entries(INGREDIENTS)) {
    const id = await mealId(page, meal);
    await page.evaluate(({ hid, id, ingredients }) =>
      firebase.firestore().doc("households/" + hid + "/meals/" + id).update({ ingredients }), { hid, id, ingredients });
  }
}

// Locks in the week's dinners, from the Shopping tab.
async function planWeek(page) {
  const ids = [];
  for (const meal of PLAN) ids.push(await mealId(page, meal));
  await page.click("#tab-shop");
  for (const id of ids) await page.click(`[data-plan="${id}"]`);
  await expect(page.locator(".buy-item").first()).toBeVisible();
}

async function rawShots(browser, set) {
  const L = layout(set);
  const ctx = await browser.newContext({
    baseURL: "http://127.0.0.1:5180",
    viewport: { width: set.css, height: L.cssH },
    deviceScaleFactor: L.dpr,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light"
  });
  await ctx.addInitScript(() => { try { delete Navigator.prototype.share; } catch (e) {} });
  await ctx.addInitScript(fakeNative);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/index.html?emu=1");
  await expect(page.locator("#barStatus")).toHaveText(/Not joined/i);
  const emoji = emojiOverride(set);
  if (emoji) await useEmojiFont(page, emoji);
  await buildFamily(page);
  // The one-time "Privacy Policy and Terms were updated" line is for phones
  // that were in a family before the change; a store screenshot shows the
  // app as it looks once that has been read.
  if (await page.locator("#policyOk").count()) {
    await page.click("#policyOk");
    await expect(page.locator("#policyOk")).toHaveCount(0);
  }

  const raw = {};
  const settle = async () => {
    await page.evaluate(() => document.fonts.ready);
    if (emoji) {
      await expect.poll(() => page.evaluate((f) => document.fonts.check('27px "' + f + '"', "🍔"), emoji)).toBe(true);
    }
    await page.waitForTimeout(400);
  };
  const snap = async (key) => { await settle(); raw[key] = await page.screenshot(); };

  await page.evaluate(() => window.scrollTo(0, 0));
  await snap("1-pick");

  // Before the week is planned, the Shopping tab is the ranked tally.
  await page.click("#tab-shop");
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap("2-results");

  await page.click("#tab-pick");
  await planWeek(page);
  // The plan's heading just under the tabs, which stay pinned at the top.
  await page.locator("#panel-shop .section-head").first().evaluate((el) => {
    const tabs = document.querySelector("[role=tablist]");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (tabs ? tabs.getBoundingClientRect().height : 0) - 20);
  });
  await snap("3-grocery-list");

  await page.click("#tab-manage");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click("#manageInvite");
  await expect(page.locator("#codeShow")).toHaveText(/-/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap("4-invite");
  await page.click("#dlgCancel");

  await page.evaluate(() => window.scrollTo(0, 0));
  await snap("5-manage");

  await page.click("#tab-pick");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click("#whoBtn");
  await expect(page.locator("#remindToggle")).toBeVisible();
  await snap("6-reminders");

  expect(errors, "script errors on the page").toEqual([]);
  await ctx.close();
  return raw;
}

// The screen on the app's green, with its caption above.
async function compose(browser, set, png, caption) {
  const L = layout(set);
  const ctx = await browser.newContext({ viewport: { width: set.w, height: set.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const fontPx = Math.round(set.w * 0.058);
  await page.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&display=swap">
<style>
  html, body { margin: 0; width: ${set.w}px; height: ${set.h}px; overflow: hidden; background: ${GREEN}; }
  .cap { height: ${L.captionH}px; display: flex; align-items: center; justify-content: center; padding: 0 ${Math.round(set.w * 0.08)}px;
    box-sizing: border-box; color: #FFFFFF; text-align: center; font: 700 ${fontPx}px/1.15 "Fraunces", Georgia, serif; text-wrap: balance; }
  .frame { width: ${L.frameW}px; height: ${L.frameH}px; margin: 0 auto; border-radius: ${Math.round(L.frameW * 0.055)}px ${Math.round(L.frameW * 0.055)}px 0 0;
    overflow: hidden; box-shadow: 0 ${Math.round(set.w * 0.01)}px ${Math.round(set.w * 0.04)}px rgba(0, 0, 0, .28); background: #F3F5F0; }
  .frame img { display: block; width: 100%; height: 100%; }
</style></head><body>
<div class="cap">${caption}</div>
<div class="frame"><img src="data:image/png;base64,${png.toString("base64")}"></div>
</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.fonts.check('700 40px "Fraunces"'))).toBe(true);
  const out = await page.screenshot();
  await ctx.close();
  return out;
}

test("store screenshots and feature graphic", async ({ browser }) => {
  test.setTimeout(600000);
  for (const set of SETS) {
    const raw = await rawShots(browser, set);
    mkdirSync(OUT + "/" + set.key, { recursive: true });
    for (const s of SHOTS) {
      writeFileSync(`${OUT}/${set.key}/${s.file}.png`, await compose(browser, set, raw[s.file], s.caption));
    }
  }

  // Google Play's feature graphic, 1024 x 500: the pot and the name.
  mkdirSync("store/graphics", { recursive: true });
  const pot = readFileSync("icons/pot.svg").toString("base64");
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Public+Sans:wght@500&display=swap">
<style>
  html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; background: ${GREEN}; }
  .row { height: 500px; display: flex; align-items: center; justify-content: center; gap: 44px; }
  img { width: 220px; height: 220px; }
  h1 { margin: 0; color: #FFFFFF; font: 700 74px/1.05 "Fraunces", Georgia, serif; }
  p { margin: 14px 0 0; color: #D6EBDD; font: 500 30px/1.3 "Public Sans", Arial, sans-serif; }
</style></head><body>
<div class="row"><img src="data:image/svg+xml;base64,${pot}" alt=""><div><h1>Dinner Decisions</h1><p>Dinner, decided together</p></div></div>
</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.fonts.check('700 40px "Fraunces"'))).toBe(true);
  writeFileSync("store/graphics/play-feature-graphic-1024x500.png", await page.screenshot());
  await ctx.close();
  writeFileSync("store/graphics/play-icon-512.png", readFileSync("icons/icon-512.png"));
});
