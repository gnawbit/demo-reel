import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/tabretake.mjs", import.meta.url));
const run = (args, cwd) => exec(process.execPath, [cli, ...args], {
  cwd, windowsHide: true, timeout: 25000,
});

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-init-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("init creates a story that record can use", { timeout: 30000 }, async (t) => {
  const dir = await tempDir(t);
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Starter fixture</title><h1>Ready to record</h1>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/?view=demo#start`;
  const config = path.join("my stories", "starter.json");
  await run(["init", "--url", url, "--out", config], dir);
  const story = JSON.parse(await readFile(path.join(dir, config), "utf8"));
  assert.equal(story.url, url);
  assert.equal(story.displayUrl, new URL(url).host);

  await run(["record", "--config", config, "--out", "output"], dir);
  const record = JSON.parse(await readFile(path.join(dir, "output", "record.json"), "utf8"));
  assert.equal(record.url, url);
  assert.ok(record.duration >= 1, "starter must produce a usable recording");
  assert.ok((await stat(path.join(dir, "output", record.video))).size > 0);
});

test("init preserves an existing story", async (t) => {
  const dir = await tempDir(t);
  const original = '{"steps":[{"action":"wait","ms":3000}]}\n';
  await writeFile(path.join(dir, "demo.json"), original);
  await assert.rejects(run(["init", "--url", "https://example.com"], dir), (error) => {
    assert.match(error.stderr, /already exists/);
    return true;
  });
  assert.equal(await readFile(path.join(dir, "demo.json"), "utf8"), original);
});

test("init requires a valid web URL before creating a file", async (t) => {
  const dir = await tempDir(t);
  for (const args of [[], ["--url", "not-a-url"], ["--url", "file:///tmp/page.html"]]) {
    await assert.rejects(run(["init", ...args], dir));
  }
  await assert.rejects(stat(path.join(dir, "demo.json")), { code: "ENOENT" });
});

test("init with --auto discovers interactive elements and builds a multi-step story", { timeout: 30000 }, async (t) => {
  const dir = await tempDir(t);
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html>
      <title>Interactive App</title>
      <input type="text" name="task" placeholder="Type here">
      <button type="button">Submit Task</button>
    `);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const config = path.join(dir, "auto.json");
  await run(["init", "--url", url, "--out", config, "--auto"], dir);
  const story = JSON.parse(await readFile(config, "utf8"));
  assert.equal(story.url, url + "/");
  assert.ok(story.steps.length > 2, "must generate multiple interactive steps");
  assert.ok(story.steps.some((s) => s.action === "type" && s.value === "Test drive"));
  assert.ok(story.steps.some((s) => s.action === "click"));
});

test("init --auto fills type-appropriate sample values for email, url and number inputs", { timeout: 30000 }, async (t) => {
  const dir = await tempDir(t);
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html>
      <main>
        <form>
          <input id="email" type="email" name="email" placeholder="Work email">
          <input id="qty" type="number" name="qty" placeholder="Seats">
          <input id="site" type="url" name="site" placeholder="Homepage">
          <button type="submit">Continue</button>
        </form>
      </main>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const config = path.join(dir, "typed.json");
  await run(["init", "--url", url, "--out", config, "--auto"], dir);
  const story = JSON.parse(await readFile(config, "utf8"));
  const emailStep = story.steps.find((s) => s.selector === "#email");
  assert.equal(emailStep?.value, "demo@example.com");
});

test("init --auto prioritizes primary controls over sidebar hash links and destructive actions", { timeout: 30000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-init-smart-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html>
      <aside>
        <nav>
          <a href="#">Overview</a>
          <a href="#">Projects</a>
        </nav>
        <button type="button">Log out</button>
      </aside>
      <header>
        <input type="search" placeholder="Search...">
        <button id="new-project" class="primary-button">New project</button>
      </header>
      <main>
        <button class="danger">Delete workspace</button>
      </main>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const config = path.join(dir, "smart.json");
  await run(["init", "--url", url, "--out", config, "--auto"], dir);
  const story = JSON.parse(await readFile(config, "utf8"));
  const clickTargets = story.steps.filter((s) => s.action === "click").map((s) => s.selector);
  assert.ok(clickTargets.includes("#new-project"), `expected #new-project in ${JSON.stringify(story.steps)}`);
  assert.equal(story.steps.some((s) => /Overview|Log out|Delete/.test(s.caption || "")), false);
  // Ensure no consecutive duplicate wait steps at tail
  assert.notEqual(story.steps.at(-2)?.action, "wait");
  assert.deepEqual(story.steps.at(-1), { action: "wait", ms: 1200 });
});

test("init --auto surfaces browser setup hint when falling back without a browser", async (t) => {
  const dir = await tempDir(t);
  const preload = `
    import { chromium } from ${JSON.stringify(import.meta.resolve("playwright"))};
    chromium.executablePath = () => "/missing/chromium";
    chromium.launch = async () => { throw new Error("Executable doesn't exist at /missing/chromium"); };
  `;
  const config = path.join(dir, "fallback.json");
  const { stderr } = await exec(process.execPath, [
    "--import", `data:text/javascript,${encodeURIComponent(preload)}`,
    cli, "init", "--url", "https://example.com", "--out", config, "--auto",
  ], { cwd: dir, windowsHide: true, timeout: 15000 });
  assert.match(stderr, /tabretake setup/);
  const story = JSON.parse(await readFile(config, "utf8"));
  assert.deepEqual(story.steps, [{ action: "wait", ms: 1500 }]);
});
