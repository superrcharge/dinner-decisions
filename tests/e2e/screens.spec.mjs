// Screenshots of every new screen, light and dark, at a small and a large
// phone width, for checking by eye. Written to test-results/screens/.

import { test, expect } from "@playwright/test";
import { phone, startFamily, joinWith } from "./helpers.mjs";

for (const colorScheme of ["light", "dark"]) {
  for (const width of [375, 430]) {
    test(`screens ${colorScheme} ${width}`, async ({ browser }) => {
      const dir = `test-results/screens/${colorScheme}-${width}-`;
      const snap = (p, name) => p.screenshot({ path: dir + name + ".png" });

      const ana = await phone(browser, { colorScheme, width, height: 800 });
      await snap(ana, "01-welcome");

      await ana.click("#welcomeStart");
      await ana.fill("#startFamily", "The Riveras");
      await ana.fill("#startName", "Ana");
      await snap(ana, "02-start");

      await ana.click("#startGo");
      await expect(ana.locator("#codeShow")).toHaveText(/-/);
      await snap(ana, "03-invite-fresh");
      const code = await ana.textContent("#codeShow");
      await ana.click("#dlgCancel");
      await snap(ana, "04-empty-family");

      await ana.click("#starterBtn");
      await expect(ana.locator(".tile")).toHaveCount(16);
      await snap(ana, "05-starters");

      await ana.click("#whoBtn");
      await snap(ana, "06-chip-menu");
      await ana.click("#leaveFamily");
      await snap(ana, "07-leave");
      await ana.click("#dlgCancel");

      await ana.click("#tab-manage");
      await ana.locator("#manageInvite").scrollIntoViewIfNeeded();
      await snap(ana, "08-manage-family");
      await ana.click("#deleteFamily");
      await ana.fill("#deleteConfirm", "The Riveras");
      await snap(ana, "09-delete");
      await ana.click("#dlgCancel");
      await ana.click("#manageNewCode");
      await snap(ana, "10-new-code");
      await ana.click("#dlgCancel");

      const ben = await phone(browser, { colorScheme, width, height: 800 });
      await joinWith(ben, "ABCDE-FGHJK");
      await expect(ben.locator("#dlgError")).not.toBeEmpty();
      await snap(ben, "11-join-error");
      await ben.fill("#joinCode", code);
      await ben.click("#joinGo");
      await expect(ben.locator("#whoMenu")).toBeVisible();
      await snap(ben, "12-joined-pick-name");

      await ben.click("#sheetBackdrop");
      await ana.click("#tab-manage");
      await ana.click("#deleteFamily");
      await ana.fill("#deleteConfirm", "The Riveras");
      await ana.click("#deleteGo");
      await expect(ben.locator("#banner .notice")).toContainText("no longer part of");
      await snap(ben, "13-removed");
    });
  }
}
