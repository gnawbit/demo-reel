import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { buildCapturedStory, runCaptureSession } from "../scripts/capture.mjs";
import { inspectConfig } from "../scripts/lib/config.mjs";

test("buildCapturedStory coalesces click+type, click+select, and clamps pauses", () => {
  const story = buildCapturedStory({
    url: "https://example.com/app",
    viewport: { width: 1280, height: 720 },
    preset: "daylight",
    scale: 2,
    rawEvents: [
      { action: "click", selector: "#title", isInput: true, label: "Title", at: 1000 },
      { action: "type", selector: "#title", value: "Q", label: "Title", at: 1100 },
      { action: "type", selector: "#title", value: "Q4", label: "Title", at: 1250 },
      { action: "click", selector: "#plan", isSelect: true, label: "Plan", at: 1700 },
      { action: "select", selector: "#plan", value: "pro", label: "Pro", at: 1900 },
      { action: "click", role: "button", name: "Create", at: 4500 },
    ],
  });

  assert.equal(inspectConfig(story, { kind: "story" }).ok, true);
  assert.equal(story.scale, 2);
  assert.equal(story.brand.preset, "daylight");
  assert.deepEqual(story.steps.map((s) => s.action), ["type", "select", "click"]);
  assert.equal(story.steps[0].value, "Q4");
  assert.equal(story.steps[0].pause, 700);
  assert.equal(story.steps[1].value, "pro");
  assert.equal(story.steps[1].pause, 1800);
  assert.equal(story.steps[2].role, "button");
  assert.equal(story.steps[2].name, "Create");

  const empty = buildCapturedStory({ url: "https://example.com", rawEvents: [] });
  assert.equal(inspectConfig(empty, { kind: "story" }).ok, true);
  assert.deepEqual(empty.steps, [{ action: "wait", ms: 1500 }]);
});

test("runCaptureSession captures interactions, skips passwords, and supports focus mode", { timeout: 30000 }, async (t) => {
  const secret = "super-secret-pass-999";
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html>
      <title>Capture fixture</title>
      <input id="name" name="project-name" placeholder="Project">
      <input id="secret" type="password" aria-label="Password">
      <select id="tier" aria-label="Tier">
        <option value="free">Free</option>
        <option value="team">Team</option>
      </select>
      <button id="go">Launch</button>
      <div id="result" style="margin-top:20px;padding:12px">Result box</div>
      <script>
        document.getElementById("go").addEventListener("click", () => {
          document.getElementById("result").textContent = "Created: " + document.getElementById("name").value;
        });
      </script>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const result = await runCaptureSession({
    url,
    headless: true,
    preset: "slate",
    onReady: async ({ page }) => {
      await page.click("#name");
      await page.type("#name", "Alpha");
      await page.click("#secret");
      await page.type("#secret", secret);
      await page.selectOption("#tier", "team");
      await page.click("#go");
      // Trigger focus mode via HUD button inside shadow root, then click #result
      await page.locator("#__tabretake_capture_hud").evaluate((host) => {
        host.shadowRoot.getElementById("focus").click();
      });
      await page.click("#result");
      // Finish via HUD Save button
      await page.locator("#__tabretake_capture_hud").evaluate((host) => {
        host.shadowRoot.getElementById("save").click();
      });
    },
  });

  assert.equal(result.discarded, false);
  assert.equal(result.passwordSkipped, true);
  assert.equal(inspectConfig(result.story, { kind: "story" }).ok, true);
  const serialized = JSON.stringify(result.story);
  assert.equal(serialized.includes(secret), false, "password must never be stored in captured story");
  assert.deepEqual(result.story.steps.map((s) => s.action), ["type", "select", "click", "focus"]);
  assert.equal(result.story.steps[0].selector, "#name");
  assert.equal(result.story.steps[0].value, "Alpha");
  assert.equal(result.story.steps[1].selector, "#tier");
  assert.equal(result.story.steps[1].value, "team");
  assert.equal(result.story.steps[2].selector, "#go");
  assert.equal(result.story.steps[3].selector, "#result");
});
