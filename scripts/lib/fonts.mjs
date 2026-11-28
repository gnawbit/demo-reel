import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const POSIX_LATIN = [
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];

const POSIX_CJK = [
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
];

const fcCache = new Map();

function windowsFonts(env, files) {
  const root = (env.WINDIR || env.SystemRoot || "C:/Windows").replace(/\\/g, "/");
  return files.map((file) => path.posix.join(root, "Fonts", file));
}

function defaultFcMatch(pattern) {
  try {
    return execFileSync("fc-match", ["-f", "%{file}\n", pattern], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"],
    }).split(/\r?\n/)[0]?.trim() || null;
  } catch {
    return null;
  }
}

function matchWithFc(pattern, { exists, platform, fcMatch, useCache }) {
  if (platform === "win32") return null;
  if (useCache && fcCache.has(pattern)) {
    const cached = fcCache.get(pattern);
    return cached && exists(cached) ? cached : null;
  }
  const matched = fcMatch(pattern);
  const resolved = matched && exists(matched) ? matched : null;
  if (useCache) fcCache.set(pattern, resolved);
  return resolved;
}

export function findCjkFont({
  exists = existsSync,
  env = process.env,
  platform = process.platform,
  fcMatch = defaultFcMatch,
} = {}) {
  const candidates = platform === "win32"
    ? windowsFonts(env, ["msyh.ttc", "msyhbd.ttc", "simhei.ttf", "simsun.ttc"])
    : POSIX_CJK;
  const useCache = exists === existsSync && fcMatch === defaultFcMatch;
  return candidates.find((p) => exists(p))
    || matchWithFc("sans-serif:lang=zh-cn", { exists, platform, fcMatch, useCache })
    || null;
}

export function findFont({
  exists = existsSync,
  env = process.env,
  platform = process.platform,
  fcMatch = defaultFcMatch,
} = {}) {
  const candidates = platform === "win32"
    ? windowsFonts(env, ["segoeui.ttf", "arial.ttf", "Segoe UI.ttf"])
    : POSIX_LATIN;
  const useCache = exists === existsSync && fcMatch === defaultFcMatch;
  return candidates.find((p) => exists(p))
    || matchWithFc("sans-serif", { exists, platform, fcMatch, useCache })
    || findCjkFont({ exists, env, platform, fcMatch });
}

export function hasCjk(text) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(text || ""));
}
