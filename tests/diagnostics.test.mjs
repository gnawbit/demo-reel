import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { diagnose } from "../scripts/doctor.mjs";
import { supportsNodeVersion, version } from "../scripts/lib/metadata.mjs";
import { setup } from "../scripts/setup.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const run = (args, dir = root) => exec(process.execPath, [path.join(dir, "bin/tabretake.mjs"), ...args], {
  cwd: os.tmpdir(), windowsHide: true, timeout: 20000,
});

test("runtime requirement matches the native image dependency", () => {
  for (const value of ["18.20.0", "20.0.0", "20.8.9"]) assert.equal(supportsNodeVersion(value), false);
  for (const value of ["20.9.0", "20.19.0", "22.0.0", "24.18.0"]) assert.equal(supportsNodeVersion(value), true);
});

test("version and capabilities work outside the checkout", async () => {
  assert.equal((await run(["--version"])).stdout.trim(), version);
  const { stdout, stderr } = await run(["capabilities", "--json"]);
  const result = JSON.parse(stdout);
  assert.equal(stderr, "");
  assert.equal(result.version, version);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.commands.setup.json, true);
  assert.equal(result.commands.setup.options.proxy.type, "string");
  assert.equal(result.commands.doctor.json, true);
  assert.equal(result.commands.record.json, true);
  assert.equal(result.commands.record.options.scale.type, "string");
  assert.equal(result.commands.run.json, true);
  assert.equal(result.commands.capture.json, true);
  assert.equal(result.commands.mark.json, true);
  assert.equal(result.commands.render.options["zoom-duration"].type, "string");
});

test("doctor JSON is a single report and rejects unknown arguments", async () => {
  const result = await run(["doctor", "--json"]).catch((error) => error);
  const report = JSON.parse(result.stdout);
  assert.equal(result.stderr, "");
  assert.equal(report.version, version);
  assert.equal(report.checks.length, 8);
  assert.equal(report.ok, report.summary.errors === 0);
  assert.equal(result.code || 0, report.ok ? 0 : 1);
  await assert.rejects(run(["doctor", "--json", "--unknown"]), (error) => {
    assert.equal(error.code, 1);
    assert.equal(JSON.parse(error.stdout).error.code, "ERR_PARSE_ARGS_UNKNOWN_OPTION");
    assert.equal(error.stderr, "");
    return true;
  });
  await assert.rejects(run(["plan", "--url", "http://127.0.0.1:1"]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /^Error: Could not open the target page\.\r?\nHint: /);
    assert.doesNotMatch(error.stderr, /\n\s+at /);
    return true;
  });
});

test("missing optional fonts warn; failed native binaries block readiness", async () => {
  const options = { fonts: { latin: () => null, cjk: () => null } };
  const report = await diagnose(options);
  assert.equal(report.summary.warnings, 2);
  assert.ok(report.checks.filter((c) => c.id.startsWith("font.")).every((c) => !c.required));
  assert.equal(report.ok, report.checks.every((c) => c.status !== "error"));
  const broken = await diagnose({ ...options, run: async () => { throw new Error("Cannot execute binary"); } });
  assert.equal(broken.ok, false);
  for (const id of ["ffmpeg", "ffprobe"]) {
    const check = broken.checks.find((c) => c.id === id);
    assert.equal(check.status, "error");
    assert.match(check.hint, /Reinstall/);
  }
});

test("diagnose accepts system browser fallback when bundled chromium is missing", async () => {
  const report = await diagnose({
    exists: (file) => !String(file).includes("chromium"),
    load: async (name) => {
      if (name === "playwright") return { chromium: { executablePath: () => "/missing/chromium" } };
      if (name === "@ffmpeg-installer/ffmpeg" || name === "@ffprobe-installer/ffprobe") {
        return { default: { path: "/fake/bin" } };
      }
      return import(name);
    },
    run: async () => ({ stdout: "ffmpeg version 7.0", stderr: "" }),
    fonts: { latin: () => "Arial", cjk: () => "SimHei" },
    systemBrowser: () => ({ channel: "chrome", path: "/usr/bin/google-chrome" }),
  });
  const check = report.checks.find((c) => c.id === "chromium");
  assert.equal(check.status, "ok");
  assert.match(check.detail, /chrome fallback/);
});

test("an installation with no dependencies can still diagnose itself", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-diagnostics-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ["bin", "scripts", "package.json"]) {
    await cp(path.join(root, name), path.join(dir, name), { recursive: true });
  }
  assert.equal((await run(["--version"], dir)).stdout.trim(), version);
  assert.ok(JSON.parse((await run(["capabilities", "--json"], dir)).stdout).commands.doctor);
  await assert.rejects(run(["doctor", "--json"], dir), (error) => {
    const report = JSON.parse(error.stdout);
    assert.equal(error.code, 1);
    assert.equal(error.stderr, "");
    assert.equal(report.summary.errors, 5);
    for (const id of ["ffmpeg", "ffprobe", "chromium", "sharp", "config-validator"]) {
      assert.equal(report.checks.find((c) => c.id === id).status, "error");
    }
    return true;
  });
});

function fakeSpawn(emitFn) {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    calls.push({ cmd, args, opts });
    queueMicrotask(() => emitFn(child));
    return child;
  };
  return { spawn, calls };
}

test("setup forwards proxy and --with-deps and classifies network/permission failures", async () => {
  const sink = new PassThrough();
  const ok = fakeSpawn((child) => {
    child.stdout.end("Downloading Chromium...\n");
    child.stderr.end();
    child.emit("close", 0, null);
  });
  await setup(["--with-deps", "--proxy", "http://127.0.0.1:10808"], {
    spawn: ok.spawn, env: {}, stdout: sink, stderr: sink,
  });
  assert.deepEqual(ok.calls[0].args.slice(1), ["install", "chromium", "--with-deps"]);
  assert.equal(ok.calls[0].opts.env.HTTPS_PROXY, "http://127.0.0.1:10808");
  assert.equal(ok.calls[0].opts.env.http_proxy, "http://127.0.0.1:10808");
  await assert.rejects(
    setup(["--proxy", "   "], { spawn: ok.spawn, env: {}, stdout: sink, stderr: sink }),
    { code: "INVALID_CONFIG" },
  );

  const netFail = fakeSpawn((child) => {
    child.stderr.write("\x1b[31mError: Failed to download Chromium, caused by\n");
    child.stderr.write("Request to https://user:secret@cdn.playwright.dev/ failed: connect ETIMED");
    child.stderr.end("OUT 1.2.3.4\n");
    child.stdout.end("Error: Download failure, code=1\n");
    child.emit("close", 1, null);
  });
  await assert.rejects(
    setup([], { spawn: netFail.spawn, env: {}, stdout: sink, stderr: sink }),
    (error) => {
      assert.equal(error.code, "CHROMIUM_SETUP_FAILED");
      assert.match(error.message, /exit 1.*connect ETIMEDOUT/);
      assert.doesNotMatch(error.message, /secret/);
      assert.match(error.hint, /PLAYWRIGHT_DOWNLOAD_HOST=https:\/\/cdn\.npmmirror\.com\/binaries\/playwright/);
      return true;
    },
  );

  const permFail = fakeSpawn((child) => {
    child.stdout.end();
    child.stderr.end("Error: EACCES: permission denied, mkdir '/root/.cache/ms-playwright'\n");
    child.emit("close", 1, null);
  });
  await assert.rejects(
    setup([], { spawn: permFail.spawn, env: {}, stdout: sink, stderr: sink }),
    (error) => {
      assert.equal(error.code, "CHROMIUM_SETUP_FAILED");
      assert.match(error.message, /EACCES: permission denied/);
      assert.match(error.hint, /PLAYWRIGHT_BROWSERS_PATH/);
      return true;
    },
  );
});
