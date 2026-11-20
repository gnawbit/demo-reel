import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  clickAndType, dragBy, hover, launchBrowser, moveAndClick, resolveLocator,
} from "../scripts/lib/browser.mjs";

let browser;
before(async () => { browser = await launchBrowser({}); });
after(async () => { await browser?.close(); });

for (const location of ["visible", "below fold", "scroll container"]) {
  for (const action of ["click", "type", "hover", "drag"]) {
    test(`${action} reaches a target ${location}`, { timeout: 15000 }, async (t) => {
      const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
      t.after(() => page.close());
      const tag = action === "type" ? "input" : "button";
      const margin = location === "visible" ? 16 : 1200;
      const container = location === "scroll container"
        ? "height:240px;overflow:auto" : "";
      await page.setContent(`<!doctype html>
        <div id="container" style="${container}">
          <${tag} id="target" style="display:block;margin-top:${margin}px;width:120px;height:60px"></${tag}>
          <div style="height:1000px"></div>
        </div>`);
      await page.evaluate(() => {
        const target = document.querySelector("#target");
        target.addEventListener("click", () => { target.dataset.clicked = "true"; });
        target.addEventListener("pointerenter", () => { target.dataset.hovered = "true"; });
        target.addEventListener("pointerdown", (event) => {
          const start = { x: event.clientX, y: event.clientY };
          window.addEventListener("pointerup", (end) => {
            window.dragDelta = { x: end.clientX - start.x, y: end.clientY - start.y };
          }, { once: true });
        });
      });

      const locator = await resolveLocator(page, { selector: "#target" });
      let point;
      if (action === "click") {
        point = await moveAndClick(page, locator, 0);
        assert.equal(await locator.getAttribute("data-clicked"), "true");
      } else if (action === "type") {
        point = await clickAndType(page, locator, "Release demo", 0);
        assert.equal(await locator.inputValue(), "Release demo");
      } else if (action === "hover") {
        point = await hover(page, locator, 0);
        assert.equal(await locator.getAttribute("data-hovered"), "true");
      } else {
        point = await dragBy(page, locator, 20, 12, 3, 0);
        assert.deepEqual(await page.evaluate(() => window.dragDelta), { x: 20, y: 12 });
      }

      assert.ok(point.x >= 0 && point.x < 640, "event x must be inside the recorded viewport");
      assert.ok(point.y >= 0 && point.y < 480, "event y must be inside the recorded viewport");
    });
  }
}
