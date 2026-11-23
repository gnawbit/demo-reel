import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { navigate } from "../scripts/lib/navigation.mjs";
import { errorReport } from "../scripts/lib/report.mjs";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/demo-reel.mjs", import.meta.url));

test("navigation failures redact URL credentials and suggest page recovery", async () => {
  const url = "https://fixture-user:fixture-password@example.test/?token=fixture-token";
  for (const allowAuthErrors of [false, true]) {
    for (const name of ["Error", "TimeoutError"]) {
      const page = { goto: async () => { throw Object.assign(new Error(`Failed at ${url}`), { name }); } };
      await assert.rejects(navigate(page, url, { allowAuthErrors }), (error) => {
        const report = errorReport("plan", error);
        assert.equal(report.error.code, "PAGE_UNREACHABLE");
        assert.match(report.error.hint, /start the app/);
        assert.doesNotMatch(JSON.stringify(report) + error.stack, /fixture-user|fixture-password|fixture-token/);
        if (name === "TimeoutError") assert.match(report.error.message, /time/);
        return true;
      });
    }
  }
  const response = { status: () => 200 };
  assert.equal(await navigate({ goto: async () => response }, url), response);
  assert.equal(await navigate({ goto: async () => null }, url), null);
});

test("login navigation permits authentication pages without accepting other error pages", async () => {
  const url = "https://example.test/?token=fixture-token";
  for (const status of [401, 403, 404, 500]) {
    const response = { status: () => status };
    const page = { goto: async () => response };
    for (const allowAuthErrors of [false, true]) {
      if (allowAuthErrors && (status === 401 || status === 403)) {
        assert.equal(await navigate(page, url, { allowAuthErrors }), response);
      } else {
        await assert.rejects(navigate(page, url, { allowAuthErrors }), (error) => {
          assert.equal(error.code, "PAGE_HTTP_ERROR");
          assert.equal(error.status, status);
          assert.doesNotMatch(error.stack + JSON.stringify(errorReport("plan", error)), /fixture-token/);
          return true;
        });
      }
    }
  }
});

test("plan and record login failures redact URLs and close the browser", { timeout: 45000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "demo-reel-login-navigation-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  // Exercise the interactive CLI branch without requiring a desktop in CI.
  const preload = `
    import { chromium } from ${JSON.stringify(import.meta.resolve("playwright"))};
    Object.defineProperty(process.stdin, "isTTY", { value: true });
    const launch = chromium.launch.bind(chromium);
    chromium.launch = async (options) => {
      const browser = await launch({ ...options, headless: true });
      browser.on("disconnected", () => console.error("fixture-browser-closed"));
      return browser;
    };
  `;
  const url = "http://fixture-user:fixture-password@127.0.0.1:1/?token=fixture-token";
  const file = path.join(dir, "story.json");
  await writeFile(file, JSON.stringify({ url, steps: [{ action: "wait", ms: 10 }] }));
  for (const args of [["plan", "--url", url], ["record", "--config", file]]) {
    await assert.rejects(exec(process.execPath, [
      "--import", `data:text/javascript,${encodeURIComponent(preload)}`, cli, ...args, "--login",
    ], { cwd: dir, windowsHide: true, timeout: 15000 }), (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.killed, false);
      assert.match(error.stderr, /Could not open the target page/);
      assert.match(error.stderr, /fixture-browser-closed/);
      assert.doesNotMatch(error.stdout + error.stderr, /fixture-user|fixture-password|fixture-token/);
      return true;
    });
  }
});

test("plan and record reject error pages and retain navigation step locations", { timeout: 45000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "demo-reel-navigation-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = createServer((req, res) => {
    res.statusCode = req.url.startsWith("/missing") ? 404 : req.url.startsWith("/private") ? 403 : 200;
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Fixture</title><button>Create</button>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function failure(args, code) {
    let report;
    await assert.rejects(exec(process.execPath, [cli, ...args, "--json"], {
      cwd: dir, windowsHide: true, timeout: 15000,
    }), (error) => {
      assert.equal(error.code, 1);
      report = JSON.parse(error.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.error.code, code);
      assert.equal(report.artifacts, undefined);
      assert.doesNotMatch(error.stdout + error.stderr, /fixture-token/);
      return true;
    });
    return report.error;
  }
  const missing = await failure(["plan", "--url", `${url}/missing?token=fixture-token`], "PAGE_HTTP_ERROR");
  assert.equal(missing.status, 404);
  assert.equal(missing.step, undefined);
  await failure(["plan", "--url", "http://127.0.0.1:1/?token=fixture-token"], "PAGE_UNREACHABLE");

  const file = path.join(dir, "story.json");
  await writeFile(file, JSON.stringify({ url: `${url}/private?token=fixture-token`, steps: [{ action: "wait", ms: 10 }] }));
  const denied = await failure(["record", "--config", file], "PAGE_HTTP_ERROR");
  assert.equal(denied.status, 403);
  assert.match(denied.hint, /--storage-state/);
  assert.equal(denied.step, undefined);

  await writeFile(file, JSON.stringify({ url, initialWait: 0, steps: [
    { action: "wait", ms: 10 }, { action: "goto", url: `${url}/missing?token=fixture-token` },
  ] }));
  const step = await failure(["record", "--config", file], "PAGE_HTTP_ERROR");
  assert.equal(step.status, 404);
  assert.deepEqual(step.step, { index: 1, action: "goto", path: "/steps/1" });
});
