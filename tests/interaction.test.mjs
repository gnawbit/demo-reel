import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/demo-reel.mjs", import.meta.url));

test("record waits for clickable targets and rejects blocked clicks", { timeout: 30000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "demo-reel-click-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const hits = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/hit") {
      hits.push(Object.fromEntries(url.searchParams));
      res.writeHead(204).end();
      return;
    }
    if (url.pathname === "/done") {
      res.end("<!doctype html><h1>Project created</h1>");
      return;
    }
    const variant = url.pathname.slice(1);
    const disabled = variant.includes("disabled") ? "disabled" : "";
    const covered = variant.includes("covered");
    const temporary = variant.startsWith("temporary");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><title>Click fixture</title>
      <button id="private-target-selector" ${disabled}
        style="position:absolute;left:40px;top:40px;width:200px;height:80px">Create project</button>
      ${covered ? '<div id="overlay" style="position:absolute;inset:0;background:#ddd;z-index:2">Loading</div>' : ""}
      <script>
        const target = document.querySelector('button');
        const report = (kind, event) => fetch('/hit?case=${variant}&target=' + kind + '&x=' + event.clientX + '&y=' + event.clientY, { keepalive: true });
        target.addEventListener('click', (event) => {
          report('button', event);
          ${covered ? "location.href = '/done';" : "target.remove();"}
        });
        document.querySelector('#overlay')?.addEventListener('click', (event) => report('overlay', event));
        ${temporary ? "setTimeout(() => { target.disabled = false; target.style.left = '300px'; document.querySelector('#overlay')?.remove(); }, 1800);" : ""}
      </script>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  for (const variant of ["disabled", "covered", "temporary-disabled", "temporary-covered"]) {
    const temporary = variant.startsWith("temporary");
    const file = path.join(dir, `${variant}.json`);
    const out = path.join(dir, variant);
    await writeFile(file, JSON.stringify({
      url: `http://127.0.0.1:${server.address().port}/${variant}?private-query-value`,
      viewport: { width: 640, height: 480 }, initialWait: 0, tail: 150,
      steps: [{ action: "wait", ms: 1 }, {
        action: "click", selector: "#private-target-selector", pause: 0,
        timeout: temporary ? 5000 : 180,
      }],
    }));
    const run = () => exec(process.execPath, [cli, "record", "--config", file, "--out", out, "--json"], {
      windowsHide: true, timeout: 10000,
    });
    if (!temporary) {
      await assert.rejects(run(), (error) => {
        const result = JSON.parse(error.stdout);
        assert.equal(error.code, 1);
        assert.equal(result.ok, false);
        assert.equal(result.error.code, "STEP_TIMEOUT");
        assert.deepEqual(result.error.step, { index: 1, action: "click", path: "/steps/1" });
        assert.equal(result.artifacts, undefined);
        assert.ok(!`${error.stdout}${error.stderr}`.includes("private-query-value"));
        assert.ok(!`${error.stdout}${error.stderr}`.includes("private-target-selector"));
        return true;
      });
      assert.equal(hits.filter((hit) => hit.case === variant).length, 0, "blocked clicks must not hit the overlay or target");
    } else {
      const result = JSON.parse((await run()).stdout);
      assert.equal(result.ok, true);
      assert.equal(result.eventCount, 1);
      const actual = hits.filter((hit) => hit.case === variant);
      assert.equal(actual.length, 1);
      assert.equal(actual[0].target, "button");
      const { events } = JSON.parse(await readFile(path.join(out, "record.json"), "utf8"));
      assert.equal(events[0].action, "click");
      assert.equal(events[0].x, Number(actual[0].x), "measure the target after it becomes actionable");
      assert.equal(events[0].y, Number(actual[0].y));
      assert.equal(events[0].x, 400, "record the target's new position after waiting");
    }
  }
});
