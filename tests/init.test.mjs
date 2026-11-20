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
const cli = fileURLToPath(new URL("../bin/demo-reel.mjs", import.meta.url));
const run = (args, cwd) => exec(process.execPath, [cli, ...args], {
  cwd, windowsHide: true, timeout: 25000,
});

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "demo-reel-init-"));
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
