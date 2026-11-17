import { expect } from "@playwright/test";

export const EMU = "http://127.0.0.1:8181/v1/projects/demo-dinner-decisions/databases/(default)/documents";
export const CODE_SHAPE = /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/;

// A fresh phone: its own storage, its own anonymous identity. Any script
// error on the page fails the test.
export async function phone(browser, opts = {}) {
  const ctx = await browser.newContext({
    baseURL: "http://127.0.0.1:5180",
    viewport: { width: opts.width || 390, height: opts.height || 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: opts.colorScheme || "light",
    ...(opts.userAgent ? { userAgent: opts.userAgent } : {})
  });
  // Headless Chromium on Windows has a real share sheet, which a test cannot
  // press. Taking it away exercises the copy fallback instead.
  await ctx.addInitScript(() => { try { delete Navigator.prototype.share; } catch (e) {} });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  // Holds anonymous sign-in back until the test calls page.releaseSignIn(),
  // to act in the moment before a phone is signed in.
  if (opts.holdSignIn) {
    let release;
    const held = new Promise((r) => { release = r; });
    page.releaseSignIn = release;
    await page.route("**/accounts:signUp*", async (route) => { await held; await route.continue(); });
  }
  await page.goto(opts.url || "/index.html?emu=1");
  if (!opts.url && !opts.holdSignIn) await expect(page.locator("#barStatus")).toHaveText(/Not joined/i);
  return page;
}

export async function startFamily(page, family, name) {
  await page.click("#welcomeStart");
  await page.fill("#startFamily", family);
  await page.fill("#startName", name);
  await page.click("#startGo");
  await expect(page.locator("#codeShow")).toHaveText(CODE_SHAPE);
  const code = await page.textContent("#codeShow");
  const link = await page.textContent("#codeLink");
  await page.click("#dlgCancel");
  await expect(page.locator("#whoName")).toHaveText(name);
  return { code, link };
}

export async function joinWith(page, typed) {
  await page.click("#welcomeJoin");
  await page.fill("#joinCode", typed);
  await page.click("#joinGo");
}

export async function addMe(page, name) {
  await expect(page.locator("#whoMenu")).toBeVisible();
  await page.click("#showAddName");
  await page.fill("#personInput", name);
  await page.click("#personAdd");
  await expect(page.locator("#whoName")).toHaveText(name);
}

export async function tile(page, name) {
  return page.locator(".tile", { has: page.locator(".tile-name", { hasText: new RegExp("^" + name + "$") }) });
}

// Picks a meal the way a person does. A tap before this week's votes have
// arrived is ignored on purpose ("Still loading"), so that the phone cannot
// overwrite picks it has not seen yet; like a person, tap again until the
// tile turns on.
export async function pick(page, name) {
  const t = await tile(page, name);
  await expect(async () => {
    if ((await t.getAttribute("aria-pressed")) !== "true") await t.click();
    await expect(t).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
}

// Reads the emulator directly, around the rules, to check what is really
// stored rather than what a page believes.
export async function stored(path) {
  const r = await fetch(EMU + "/" + path, { headers: { Authorization: "Bearer owner" } });
  if (r.status === 404) return null;
  const j = await r.json();
  return j;
}

export async function storedCount(collectionPath) {
  const j = await stored(collectionPath);
  return j && j.documents ? j.documents.length : 0;
}

export async function seed(path, fields) {
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) body.fields[k] = { stringValue: v };
  const r = await fetch(EMU + "/" + path, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("seed " + path + " " + r.status);
}

export function noErrors(...pages) {
  for (const p of pages) expect(p.errors, "script errors on the page").toEqual([]);
}
