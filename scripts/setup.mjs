import { spawn as nodeSpawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { parseCommand } from "./lib/options.mjs";
import { commandError, createReporter } from "./lib/report.mjs";

const require = createRequire(import.meta.url);
const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]/g;
const MAX_TAIL_LINES = 40;
const NETWORK_RE = /ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|EPIPE|ERR_CONNECTION|ERR_TIMED_OUT|socket hang up|timed out|timeout|server returned code \d+|status code (?:403|404|407|429|500|502|503|504)|fetch failed/i;
const PERMISSION_RE = /EACCES|EPERM|EROFS|permission denied|read-only|sudo:/i;
const DEPS_RE = /--with-deps|apt-get|dnf|yum|zypper|missing dependencies|Host system is missing/i;
const FALLBACK_ERR_RE = /Failed to download|Download failure|^Error:/i;
const PROP_DUMP_RE = /^(?:errno|code|syscall|address|port):/i;

function sanitizeLine(line) {
  return line.replace(ANSI_RE, "").replace(/\/\/[^/\s@]+:[^/\s@]+@/g, "//***:***@").trim();
}

function summarizeFailure(lines, statusLabel) {
  const cleaned = lines.map(sanitizeLine).filter(Boolean);
  const matched =
    [...cleaned].reverse().find((line) => !PROP_DUMP_RE.test(line) && (NETWORK_RE.test(line) || PERMISSION_RE.test(line) || DEPS_RE.test(line))) ||
    [...cleaned].reverse().find((line) => NETWORK_RE.test(line) || PERMISSION_RE.test(line) || DEPS_RE.test(line)) ||
    [...cleaned].reverse().find((line) => FALLBACK_ERR_RE.test(line));
  const detail = matched || cleaned.at(-1);
  const joined = cleaned.join("\n");

  let hint;
  if (PERMISSION_RE.test(joined)) {
    hint = "Check write permissions for the Playwright browser cache, or set PLAYWRIGHT_BROWSERS_PATH to a writable directory.";
  } else if (DEPS_RE.test(joined)) {
    hint = "On Linux, run tabretake setup --with-deps with permission to install browser system libraries.";
  } else {
    hint = "If downloading Chromium timed out or failed, retry with --proxy <url> or PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright, or install Chrome / Edge for automatic fallback.";
  }

  return commandError(
    "CHROMIUM_SETUP_FAILED",
    detail ? `Chromium setup failed (${statusLabel}): ${detail}` : `Chromium setup failed (${statusLabel}).`,
    { hint }
  );
}

function collectTail(tail) {
  let remainder = "";
  return {
    push(chunk, target) {
      target.write(chunk);
      const lines = (remainder + String(chunk)).split(/\r?\n/);
      remainder = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          tail.push(line);
          if (tail.length > MAX_TAIL_LINES) tail.shift();
        }
      }
    },
    flush() {
      if (remainder.trim()) {
        tail.push(remainder);
        if (tail.length > MAX_TAIL_LINES) tail.shift();
      }
      remainder = "";
    },
  };
}

export async function setup(argv, {
  spawn = nodeSpawn,
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const { values } = parseCommand("setup", argv);
  if (values.proxy !== undefined && !values.proxy.trim()) {
    throw new Error("Provide a non-empty --proxy URL");
  }

  const cli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
  const args = [cli, "install", "chromium"];
  if (values["with-deps"]) args.push("--with-deps");

  const childEnv = { ...env };
  if (values.proxy) {
    const proxyUrl = values.proxy.trim();
    for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) {
      childEnv[key] = proxyUrl;
    }
  }

  const tail = [];
  const stdoutCollector = collectTail(tail);
  const stderrCollector = collectTail(tail);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
      env: childEnv,
    });
    child.stdout?.on("data", (chunk) => stdoutCollector.push(chunk, values.json ? stderr : stdout));
    child.stderr?.on("data", (chunk) => stderrCollector.push(chunk, stderr));
    child.once("error", (err) => reject(summarizeFailure([err?.message || String(err)], "spawn error")));
    child.once("close", (code, signal) => {
      stdoutCollector.flush();
      stderrCollector.flush();
      if (code === 0) resolve();
      else reject(summarizeFailure(tail, signal || `exit ${code}`));
    });
  });

  const reporter = createReporter("setup", values.json);
  reporter.log("Chromium is ready. Run tabretake demo to make your first video.");
  await reporter.success({ artifacts: [], withDeps: Boolean(values["with-deps"]) });
}
