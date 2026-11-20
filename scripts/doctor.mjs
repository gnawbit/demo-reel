import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findCjkFont, findFont } from "./lib/fonts.mjs";
import { parseCommand } from "./lib/options.mjs";
import { schemaVersion, version } from "./lib/metadata.mjs";

const exec = promisify(execFile);
const reinstall = "Reinstall CLI dependencies (from source: npm ci).";

// Load native dependencies separately so broken installs still produce a report.
export async function diagnose({
  nodeVersion = process.versions.node,
  load = (name) => import(name),
  exists = existsSync,
  run = (file) => exec(file, ["-version"], { windowsHide: true, timeout: 10000 }),
  fonts = { latin: findFont, cjk: findCjkFont },
} = {}) {
  const checks = [];
  async function check(id, required, hint, probe) {
    try {
      checks.push({ id, required, status: "ok", detail: await probe() });
    } catch (error) {
      checks.push({ id, required, status: required ? "error" : "warning", detail: error.message, hint });
    }
  }
  await check("node", true, "Install Node.js 20 or newer.", () => {
    if (Number(nodeVersion.split(".")[0]) < 20) throw new Error(`Unsupported Node.js ${nodeVersion}`);
    return nodeVersion;
  });
  for (const id of ["ffmpeg", "ffprobe"]) {
    await check(id, true, reinstall, async () => {
      const module = await load(`@${id}-installer/${id}`);
      const file = module.default.path;
      if (!file || !exists(file)) throw new Error("Executable not found");
      const { stdout, stderr } = await run(file);
      return (stdout || stderr).split("\n")[0].trim();
    });
  }
  await check("chromium", true, "Run demo-reel setup (from source: node bin/demo-reel.mjs setup).", async () => {
    const { chromium } = await load("playwright");
    const file = chromium.executablePath();
    if (!exists(file)) throw new Error("Chromium executable not found");
    return "Executable found; browser launch and system libraries are not tested.";
  });
  await check("sharp", true, reinstall, async () => {
    const { default: sharp } = await load("sharp");
    await sharp({ create: { width: 1, height: 1, channels: 4, background: "white" } }).png().toBuffer();
    return sharp.versions?.sharp || "Image encoding passed";
  });
  await check("config-validator", true, reinstall, async () => {
    const { inspectConfig } = await load("./lib/config.mjs");
    if (!inspectConfig({ marks: [] }).ok) throw new Error("Config schema could not be validated");
    return "Config schema loaded";
  });
  await check("font.latin", false, "Install Arial, Segoe UI or DejaVu Sans; captions may otherwise be skipped.", () => {
    if (!fonts.latin()) throw new Error("Caption font not found");
    return "Caption font found";
  });
  await check("font.cjk", false, "For Chinese captions, install Microsoft YaHei, PingFang or Noto Sans CJK.", () => {
    if (!fonts.cjk()) throw new Error("CJK font not found");
    return "CJK font found";
  });
  const errors = checks.filter((check) => check.status === "error").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  return { schemaVersion, version, ok: errors === 0, checks, summary: { errors, warnings } };
}

export async function doctor(argv = []) {
  const { values } = parseCommand("doctor", argv);
  const report = await diagnose();
  if (values.json) console.log(JSON.stringify(report));
  else {
    console.log(`\ndemo-reel doctor (${version})\n`);
    for (const check of report.checks) {
      console.log(`${check.status.toUpperCase().padEnd(7)} ${check.id.padEnd(14)} ${check.detail}`);
      if (check.hint) console.log(`        -> ${check.hint}`);
    }
    console.log(`\n${report.summary.errors} error(s), ${report.summary.warnings} warning(s).\n`);
  }
  if (!report.ok) process.exitCode = 1;
  return report;
}
