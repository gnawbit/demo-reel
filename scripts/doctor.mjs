import { existsSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";
import { FFMPEG, FFPROBE, run } from "./lib/ffmpeg.mjs";
import { findCjkFont, findFont } from "./lib/fonts.mjs";

export async function doctor() {
  const checks = [];

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    ok: nodeMajor >= 20,
    label: "Node.js >= 20",
    detail: process.version,
    hint: "Install Node.js 20 or newer.",
  });

  checks.push({
    ok: Boolean(FFMPEG) && existsSync(FFMPEG),
    label: "ffmpeg",
    detail: FFMPEG || "not found",
    hint: "Reinstall dependencies: npm install",
  });

  if (FFMPEG && existsSync(FFMPEG)) {
    try {
      const { stdout, stderr } = await run(FFMPEG, ["-version"], { capture: true });
      const first = (stdout || stderr).split("\n")[0].trim();
      checks.push({ ok: true, label: "ffmpeg version", detail: first });
    } catch (err) {
      checks.push({ ok: false, label: "ffmpeg version", detail: err.message });
    }
  }

  checks.push({
    ok: Boolean(FFPROBE) && existsSync(FFPROBE),
    label: "ffprobe",
    detail: FFPROBE || "not found",
    hint: "Reinstall dependencies: npm install",
  });

  let chromiumPath = "";
  try {
    chromiumPath = chromium.executablePath();
  } catch {
    chromiumPath = "";
  }
  checks.push({
    ok: Boolean(chromiumPath) && existsSync(chromiumPath),
    label: "Playwright Chromium",
    detail: chromiumPath || "not found",
    hint: "Run: npx playwright install chromium",
  });

  checks.push({
    ok: true,
    label: "sharp",
    detail: sharp.versions?.sharp || "installed",
  });

  const font = findFont();
  checks.push({
    ok: Boolean(font),
    label: "System font for captions",
    detail: font || "not found",
    hint: "Install Arial/Segoe UI, or captions will be skipped.",
  });

  const cjkFont = findCjkFont();
  checks.push({
    ok: Boolean(cjkFont),
    label: "CJK font for Chinese captions",
    detail: cjkFont || "not found",
    hint: "Install Microsoft YaHei, PingFang or Noto Sans CJK.",
  });

  console.log("\ndemo-reel doctor\n");
  for (const check of checks) {
    const mark = check.ok ? "OK  " : "FAIL";
    console.log(`${mark}  ${check.label.padEnd(28)} ${check.detail}`);
    if (!check.ok && check.hint) console.log(`      -> ${check.hint}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(
    failed.length === 0
      ? "\nEverything looks good.\n"
      : `\n${failed.length} check(s) failed.\n`,
  );

  if (failed.length > 0) process.exitCode = 1;
}
