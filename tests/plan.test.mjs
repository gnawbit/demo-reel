import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("plan excludes password values from files and logs", { timeout: 30000 }, async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), "demo-reel-plan-"));
  t.after(() => rm(out, { recursive: true, force: true }));

  const secret = "dummy-password-for-regression";
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><title>Plan fixture</title>
      <input id="password" type="password" value="${secret}" aria-label="Account password">
      <input id="confirmation" type="PASSWORD" value="${secret}" placeholder="Confirm password">
      <input id="unlabelled" type="password" value="${secret}">
      <input id="project" value="Release demo">`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const outputPath = path.join(out, "plan.json");
  const { stdout, stderr } = await exec(process.execPath, [
    "bin/demo-reel.mjs", "plan",
    "--url", `http://127.0.0.1:${server.address().port}`,
    "--out", outputPath,
  ], { cwd: root, windowsHide: true, timeout: 25000 });

  const json = await readFile(outputPath, "utf8");
  assert.equal(json.includes(secret), false, "plan.json must not contain the password");
  assert.equal((stdout + stderr).includes(secret), false, "logs must not contain the password");

  const { elements } = JSON.parse(json);
  const label = (id) => elements.find((el) => el.selector === `#${id}`)?.text;
  assert.equal(label("password"), "Account password");
  assert.equal(label("confirmation"), "Confirm password");
  assert.equal(label("unlabelled"), "");
  assert.equal(label("project"), "Release demo");
});
