import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clickAndType, dragBy, findSystemBrowser, hover, installCursor, launchBrowser, moveAndClick, openRecordedPage, resolveLocator, selectOption,
} from "../scripts/lib/browser.mjs";

let browser;
before(async () => { browser = await launchBrowser({}); });
after(async () => { await browser?.close(); });

for (const field of ["text", "name"]) {
  test(`${field} selects an exact link before a partial button`, async (t) => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent(`<!doctype html>
      <button onclick="document.querySelector('#todo').remove()">Clear completed</button>
      <a href="#completed">Completed</a>
      <div id="todo">Write release notes</div>`);

    const locator = await resolveLocator(page, { [field]: "Completed" });
    await moveAndClick(page, locator, 0);
    assert.equal(await page.locator("#todo").count(), 1, "Filtering must not clear the task");
    assert.equal(new URL(page.url()).hash, "#completed");
  });
}

test("a partial button label precedes an exact noninteractive modal heading", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(`<!doctype html>
    <button id="open" onclick="document.querySelector('#modal').style.opacity='1';this.dataset.opened='true'">
      <span>+</span> New project
    </button>
    <div id="modal" aria-hidden="true" style="opacity:0;pointer-events:none">
      <h2 id="heading">New project</h2>
    </div>`);
  assert.equal(await page.locator("#heading").isVisible(), true,
    "Opacity alone does not make the heading invisible to locator checks");
  const locator = await resolveLocator(page, { text: "New project" });
  assert.equal(await locator.getAttribute("id"), "open");
  await moveAndClick(page, locator, 0, 2000);
  assert.equal(await page.locator("#open").getAttribute("data-opened"), "true");
});

test("an explicit role prefers exact names and never falls back to another role", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(`<!doctype html>
    <button id="partial">Clear completed</button>
    <button id="exact">Completed</button>
    <a href="#other">Other</a>`);
  const exact = await resolveLocator(page, { role: "button", name: "Completed" });
  assert.equal(await exact.getAttribute("id"), "exact");
  await assert.rejects(resolveLocator(page, { role: "link", text: "Completed" }), {
    code: "TARGET_NOT_FOUND",
  });
  await page.locator("a").evaluate(element => { element.textContent = "Completed items"; });
  const partial = await resolveLocator(page, { role: "link", name: "Completed" });
  assert.equal(await partial.getAttribute("href"), "#other", "A partial match must stay within the requested role");
});

test("an explicit selector takes precedence over exact names and roles", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(`<!doctype html>
    <button id="chosen">Clear completed</button>
    <a href="#completed">Completed</a>`);
  const locator = await resolveLocator(page, {
    selector: "#chosen", role: "link", name: "Completed", text: "Completed",
  });
  assert.equal(await locator.getAttribute("id"), "chosen");
});

test("hidden exact matches allow visible partial matches and retain first-visible ordering", async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(`<!doctype html>
    <a hidden href="#hidden">Completed</a>
    <button hidden>Completed tasks</button>
    <button id="first">Completed items</button>
    <button id="second">Completed projects</button>`);
  const partial = await resolveLocator(page, { text: "Completed" });
  assert.equal(await partial.getAttribute("id"), "first");
  await page.locator("#first, #second").evaluateAll(elements => {
    for (const element of elements) element.textContent = "Completed";
  });
  const exact = await resolveLocator(page, { name: "Completed" });
  assert.equal(await exact.getAttribute("id"), "first");
});

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

test("launchBrowser falls back to system chrome/msedge when bundled chromium is absent", async () => {
  const calls = [];
  const fakeBrowser = { close: async () => {} };
  const result = await launchBrowser({
    browser: "auto",
    hasBundledChromium: () => false,
    launch: async (opts) => {
      calls.push(opts.channel || "chromium");
      if (opts.channel === "msedge") return fakeBrowser;
      throw new Error("missing channel");
    },
  });
  assert.equal(result, fakeBrowser);
  assert.deepEqual(calls, ["chrome", "msedge"]);

  await assert.rejects(
    launchBrowser({ browser: "safari" }),
    /Unsupported --browser/,
  );
});

test("findSystemBrowser detects installed Chrome or Edge paths across platforms", () => {
  const win = findSystemBrowser({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Demo\\AppData\\Local" },
    exists: (p) => p.endsWith("msedge.exe"),
  });
  assert.equal(win?.channel, "msedge");

  const mac = findSystemBrowser({
    platform: "darwin",
    exists: (p) => p.includes("Google Chrome.app"),
  });
  assert.equal(mac?.channel, "chrome");
});

test("openRecordedPage seeds missing Playwright ffmpeg from bundled ffmpeg and retries", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-ffmpeg-seed-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, "bundled-ffmpeg");
  const target = path.join(dir, "pw-cache", "ffmpeg-win64.exe");
  await writeFile(source, "ffmpeg-binary-bytes");

  let attempts = 0;
  const fakePage = { id: "page" };
  const result = await openRecordedPage({}, {}, {
    ffmpegPath: source,
    makeContext: async () => ({
      close: async () => {},
      newPage: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error(`Executable doesn't exist at ${target}\nVideo rendering requires ffmpeg binary.`);
        }
        return fakePage;
      },
    }),
  });
  assert.equal(attempts, 2);
  assert.equal(result.page, fakePage);
  assert.equal(await readFile(target, "utf8"), "ffmpeg-binary-bytes");
});

test("selectOption selects by value or label and installCursor follows theme accent", async (t) => {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  t.after(() => page.close());
  await installCursor(page, { accent: "#10b981" });
  await page.goto(`data:text/html,${encodeURIComponent(`<!doctype html>
    <select id="plan">
      <option value="basic">Basic Plan</option>
      <option value="pro">Pro Plan</option>
    </select>`)}`);

  const hasEmeraldRipple = await page.evaluate(() =>
    [...document.querySelectorAll("style")].some((s) => s.textContent.includes("rgba(16,185,129")),
  );
  assert.equal(hasEmeraldRipple, true);

  const locator = await resolveLocator(page, { selector: "#plan" });
  await selectOption(page, locator, "Pro Plan", 0);
  assert.equal(await locator.inputValue(), "pro");
  await selectOption(page, locator, "basic", 0);
  assert.equal(await locator.inputValue(), "basic");
});
