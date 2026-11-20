import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("demo records the URL of its own server", { timeout: 180000 }, async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), "demo-reel-demo-"));
  t.after(() => rm(out, { recursive: true, force: true }));

  const { stdout } = await exec(process.execPath, [
    "bin/demo-reel.mjs", "demo", "--port", "0", "--out", out,
  ], { cwd: root, windowsHide: true, timeout: 150000 });
  const serverUrl = stdout.match(/Demo site: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
  assert.ok(serverUrl, "demo must report the listening URL");
  assert.notEqual(new URL(serverUrl).port, "0", "URL must contain the assigned port");

  const record = JSON.parse(await readFile(path.join(out, "record.json"), "utf8"));
  assert.equal(record.url, serverUrl, "recording must use the server's port");
  assert.deepEqual(record.events.map((event) => event.action), ["click", "type", "click", "click"]);
});
