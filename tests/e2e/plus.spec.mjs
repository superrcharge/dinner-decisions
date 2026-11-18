import { test, expect } from "@playwright/test";
import { phone, startFamily, pick, stored, EMU, noErrors } from "./helpers.mjs";

// Dinner Decisions: Easy Mode ("plus" in the code), beta: a family turns it on in Manage, picks its
// Walmart by ZIP code, and sends the week's list to a Walmart cart. The
// server talks to the pretend Walmart (tests/fake-walmart.mjs), which checks
// every request's signature as the real one does.

const FAKE = "http://127.0.0.1:5199/_calls";
const searches = async () => (await (await fetch(FAKE)).json()).searches;
const resetSearches = () => fetch(FAKE, { method: "POST" });

const PIXEL = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="#e8eef5"/></svg>';

async function noInternet(page) {
  // Product photos and the cart page are on Walmart's real sites; the tests
  // never leave this computer.
  await page.context().route("https://i5.walmartimages.com/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: PIXEL }));
  await page.context().route("https://www.walmart.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>Walmart cart</title>cart" }));
}

async function config(fields) {
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    body.fields[k] = Array.isArray(v)
      ? { arrayValue: { values: v.map((x) => ({ stringValue: x })) } }
      : { integerValue: String(v) };
  }
  const r = await fetch(EMU + "/config/plusBeta", {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("config " + r.status);
}

// A family with Chili and Tacos planned and their ingredients listed.
async function plannedFamily(browser) {
  const ana = await phone(browser);
  await noInternet(ana);
  await startFamily(ana, "The Riveras", "Ana");
  await ana.click("#starterBtn");
  await expect(ana.locator(".tile")).toHaveCount(16);
  for (const n of ["Chili", "Tacos"]) await pick(ana, n);
  await ana.click("#tab-shop");
  await ana.click('[data-plan="chili"]');
  await ana.click('[data-plan="tacos"]');
  await ana.click("#tab-manage");
  const ing = { chili: ["Ground beef", "Onion", "Unobtainium"], tacos: ["Tortillas", "onion"] };
  for (const [id, list] of Object.entries(ing)) {
    await ana.click(`[data-addingr="${id}"]`);
    for (const g of list) {
      await ana.fill(`#ingInput-${id}`, g);
      await ana.click(`[data-addingrgo="${id}"]`);
    }
  }
  const hid = await ana.evaluate(() => localStorage.getItem("dinner.householdId"));
  return { ana, hid };
}

test.beforeEach(async () => {
  await config({ cap: 10, hids: [] });
});

test("Easy Mode beta: turn it on, pick a Walmart, choose products, open the cart, and next week's list remembers them", async ({ browser }) => {
  const { ana, hid } = await plannedFamily(browser);

  // Off: Manage offers the beta, and the list has no cart button.
  await expect(ana.locator("#plusJoin")).toHaveText("Try Easy Mode");
  await ana.click("#tab-shop");
  await expect(ana.locator("#printBuy")).toBeVisible();
  await expect(ana.locator("#storeBuy")).toHaveCount(0);

  await ana.click("#tab-manage");
  await ana.click("#plusJoin");
  await expect(ana.locator("#plusBox .row-name")).toHaveText(/Easy Mode\s*on/);
  expect((await stored(`households/${hid}/billing/plan`)).fields.status.stringValue).toBe("beta");

  // The first time: find the family's Walmart by ZIP code.
  await ana.click("#tab-shop");
  await ana.click("#storeBuy");
  await expect(ana.locator("#dialog .dialog-title")).toHaveText("Your Walmart");
  await ana.fill("#wmZip", "123");
  await ana.click("#wmFind");
  await expect(ana.locator("#dlgError")).toHaveText("Type a 5-digit ZIP code.");
  await ana.fill("#wmZip", "00000");
  await ana.click("#wmFind");
  await expect(ana.locator("#dlgError")).toHaveText("No Walmart stores found near 00000.");
  await ana.fill("#wmZip", "28303");
  await ana.press("#wmZip", "Enter");
  await expect(ana.locator(".wm-store")).toHaveCount(3);
  await ana.screenshot({ path: "test-results/screens/plus-stores.png" });
  await ana.locator(".wm-store").first().click();

  // The list, matched: one product per item, the item it is for under it,
  // and what Walmart has nothing for listed to add by hand.
  await expect(ana.locator("#dialog .dialog-title")).toHaveText("Send to Walmart");
  await expect(ana.locator(".wm-where")).toContainText("Walmart Supercenter");
  await expect(ana.locator(".wm-item")).toHaveCount(3);
  await expect(ana.locator(".wm-for")).toHaveText(["For Ground beef", "For Onion", "For Tortillas"]);
  await expect(ana.locator(".wm-missing")).toContainText("Unobtainium");
  await expect(ana.locator(".wm-fine")).toContainText("3 items go into your cart");
  await ana.screenshot({ path: "test-results/screens/plus-list.png" });
  expect((await stored(`households/${hid}/store/walmart`)).fields.storeId.stringValue).toBe("1234");

  // Change Onion to the second choice; leave Tortillas off.
  const onion = ana.locator('[data-wmrow="onion"]');
  await onion.locator("[data-wmchange]").click();
  await expect(onion.locator(".wm-option")).toHaveCount(4);
  await ana.screenshot({ path: "test-results/screens/plus-change.png" });
  await onion.locator(".wm-option").nth(1).click();
  await expect(onion.locator(".wm-row .wm-name")).toHaveText("Marketside Onion, Family Size");
  const tortillas = ana.locator('[data-wmrow="tortillas"]');
  await tortillas.locator("[data-wmchange]").click();
  await tortillas.locator(".wm-skip").click();
  await expect(tortillas.locator(".wm-row .wm-name")).toHaveText("Left off the cart");
  await expect(ana.locator(".wm-fine")).toContainText("2 items go into your cart");

  const href = await ana.locator("#wmCart").getAttribute("href");
  const url = new URL(href);
  expect(url.origin + url.pathname).toBe("https://www.walmart.com/sc/cart/addToCart");
  expect(url.searchParams.get("storeId")).toBe("1234");
  const items = url.searchParams.get("items").split(",");
  expect(items).toHaveLength(2);
  for (const i of items) expect(i).toMatch(/^\d+_1$/);
  await expect(ana.locator("#wmCart")).toHaveAttribute("target", "_blank");

  const [cart] = await Promise.all([ana.context().waitForEvent("page"), ana.click("#wmCart")]);
  await cart.waitForLoadState();
  expect(cart.url()).toBe(href);
  await cart.close();

  // The chosen products are remembered; the one left off is not.
  await expect.poll(async () => (await stored(`households/${hid}/matches/onion`))?.fields.name.stringValue)
    .toBe("Marketside Onion, Family Size");
  expect(await stored(`households/${hid}/matches/ground-beef`)).not.toBeNull();
  expect(await stored(`households/${hid}/matches/tortillas`)).toBeNull();

  // Next time: straight to the list at the same store, the remembered
  // products are not searched again.
  await ana.click("#dlgCancel");
  await resetSearches();
  await ana.click("#storeBuy");
  await expect(ana.locator("#dialog .dialog-title")).toHaveText("Send to Walmart");
  await expect(onion.locator(".wm-row .wm-name")).toHaveText("Marketside Onion, Family Size");
  await expect(ana.locator(".wm-fine")).toContainText("3 items go into your cart");
  expect(await searches()).toBe(2); // Tortillas and Unobtainium only

  // Change on a remembered product searches for other choices, keeping it first.
  await onion.locator("[data-wmchange]").click();
  await expect(onion.locator(".wm-option")).toHaveCount(4);
  await expect(onion.locator(".wm-option").first()).toHaveAttribute("aria-pressed", "true");
  await expect(onion.locator(".wm-option").first()).toContainText("Marketside Onion, Family Size");

  // Change Store goes back to the ZIP search.
  await ana.click("#wmChangeStore");
  await expect(ana.locator("#wmZip")).toHaveValue("28303");
  await ana.click("#dlgCancel");

  // Leaving the beta takes the cart button away.
  await ana.click("#tab-manage");
  await ana.click("#plusLeave");
  await ana.click("#plusLeaveGo");
  await expect(ana.locator("#plusJoin")).toBeVisible();
  await ana.click("#tab-shop");
  await expect(ana.locator("#storeBuy")).toHaveCount(0);
  expect(await stored(`households/${hid}/billing/plan`)).toBeNull();
  noErrors(ana);
});

test("Easy Mode beta: spots are limited, and only the family's own phones can use it", async ({ browser }) => {
  const { ana, hid } = await plannedFamily(browser);
  await config({ cap: 1, hids: ["SomeOtherFamily0000"] });
  await ana.click("#plusJoin");
  await expect(ana.locator("#plusError")).toHaveText("The beta is full right now.");
  await expect(ana.locator("#plusJoin")).toHaveText("Try Easy Mode");

  await config({ cap: 1, hids: [] });
  await ana.click("#plusJoin");
  await expect(ana.locator("#plusLeave")).toBeVisible();

  // A phone from another family cannot act for this one, or give itself Easy Mode.
  const eve = await phone(browser);
  await startFamily(eve, "The Eves", "Eve");
  const tryCall = (name, data) => eve.evaluate(([n, d]) =>
    firebase.functions().httpsCallable(n)(d).then(() => "ok", (e) => String(e.code).replace(/^functions\//, "")), [name, data]);
  expect(await tryCall("walmartStores", { hid, zip: "28303" })).toBe("permission-denied");
  expect(await tryCall("leavePlusBeta", { hid })).toBe("permission-denied");
  const eveHid = await eve.evaluate(() => localStorage.getItem("dinner.householdId"));
  expect(await tryCall("walmartStores", { hid: eveHid, zip: "28303" })).toBe("failed-precondition");
  expect(await tryCall("joinPlusBeta", { hid: eveHid })).toBe("resource-exhausted");
  noErrors(ana, eve);
});

test("deleting a family gives its beta spot back and leaves nothing of Easy Mode behind", async ({ browser }) => {
  const { ana, hid } = await plannedFamily(browser);
  await ana.click("#plusJoin");
  await expect(ana.locator("#plusLeave")).toBeVisible();
  await ana.click("#tab-shop");
  await ana.click("#storeBuy");
  await ana.fill("#wmZip", "28303");
  await ana.click("#wmFind");
  await ana.locator(".wm-store").first().click();
  await expect(ana.locator(".wm-item")).toHaveCount(3);
  const [cart] = await Promise.all([ana.context().waitForEvent("page"), ana.click("#wmCart")]);
  await cart.close();
  await expect.poll(() => stored(`households/${hid}/matches/onion`)).not.toBeNull();
  await ana.click("#dlgCancel");

  await ana.click("#tab-manage");
  await ana.click("#deleteFamily");
  await ana.fill("#deleteConfirm", "The Riveras");
  await ana.click("#deleteGo");
  await expect(ana.locator("#banner .notice")).toHaveText("The Riveras was deleted.");

  for (const p of ["billing/plan", "store/walmart", "matches/onion", "matches/ground-beef"]) {
    expect(await stored(`households/${hid}/${p}`), p).toBeNull();
  }
  await expect.poll(async () => {
    const c = await stored("config/plusBeta");
    return (c.fields.hids.arrayValue.values || []).map((v) => v.stringValue);
  }).toEqual([]);
  await expect.poll(() => stored(`households/${hid}/private/usage`)).toBeNull();
  noErrors(ana);
});

// The Easy Mode screens, light and dark, at a small and a large phone width, for
// checking by eye. Written to test-results/screens/.
for (const colorScheme of ["light", "dark"]) {
  for (const width of [375, 430]) {
    test(`plus screens ${colorScheme} ${width}`, async ({ browser }) => {
      const ana = await phone(browser, { colorScheme, width, height: 800 });
      const snap = (name) => ana.screenshot({ path: `test-results/screens/${colorScheme}-${width}-plus-${name}.png` });
      await noInternet(ana);
      await startFamily(ana, "The Riveras", "Ana");
      await ana.click("#starterBtn");
      await expect(ana.locator(".tile")).toHaveCount(16);
      for (const n of ["Chili", "Tacos"]) await pick(ana, n);
      await ana.click("#tab-shop");
      await ana.click('[data-plan="chili"]');
      await ana.click('[data-plan="tacos"]');
      await ana.click("#tab-manage");
      for (const [id, list] of Object.entries({ chili: ["Ground beef", "Yellow onion", "Unobtainium", "Kidney beans, 15 oz can"], tacos: ["Tortillas", "Shredded cheddar cheese"] })) {
        await ana.click(`[data-addingr="${id}"]`);
        for (const g of list) {
          await ana.fill(`#ingInput-${id}`, g);
          await ana.click(`[data-addingrgo="${id}"]`);
        }
      }

      await ana.locator("#plusJoin").scrollIntoViewIfNeeded();
      await snap("01-manage-off");
      await ana.click("#plusJoin");
      await expect(ana.locator("#plusLeave")).toBeVisible();
      await snap("02-manage-on");

      await ana.click("#tab-shop");
      await ana.evaluate(() => window.scrollTo(0, 0));
      await expect(ana.locator("#storeBuy")).toBeVisible();
      await snap("03-list-buttons");
      await ana.click("#storeBuy");
      await snap("04-store-empty");
      await ana.fill("#wmZip", "28303");
      await ana.click("#wmFind");
      await expect(ana.locator(".wm-store")).toHaveCount(3);
      await snap("05-stores");
      await ana.locator(".wm-store").first().click();
      await expect(ana.locator(".wm-item")).toHaveCount(5);
      await snap("06-list");
      await ana.locator('[data-wmrow="yellow-onion"] [data-wmchange]').click();
      await expect(ana.locator('[data-wmrow="yellow-onion"] .wm-option')).toHaveCount(4);
      await snap("07-change");
      await ana.locator('[data-wmrow="yellow-onion"] .wm-skip').click();
      await ana.locator(".wm-missing").scrollIntoViewIfNeeded();
      await snap("08-left-off");
      await ana.click("#dlgCancel");
      await ana.click("#tab-manage");
      await ana.click("#plusLeave");
      await snap("09-leave");
    });
  }
}
