import { existsSync } from "node:fs";
import path from "node:path";

export const VALID_BROWSERS = new Set(["auto", "chromium", "chrome", "msedge"]);

const PATH_BINARIES = {
  win32: [
    { channel: "chrome", name: "chrome.exe" },
    { channel: "msedge", name: "msedge.exe" },
  ],
  darwin: [
    { channel: "chrome", name: "Google Chrome" },
    { channel: "msedge", name: "Microsoft Edge" },
  ],
  linux: [
    { channel: "chrome", name: "google-chrome" },
    { channel: "chrome", name: "google-chrome-stable" },
    { channel: "msedge", name: "microsoft-edge" },
    { channel: "msedge", name: "microsoft-edge-stable" },
  ],
};

export function findSystemBrowser({
  exists = existsSync,
  platform = process.platform,
  env = process.env,
} = {}) {
  const candidates = [];
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean);
    for (const root of roots) {
      candidates.push({ channel: "chrome", path: path.join(root, "Google", "Chrome", "Application", "chrome.exe") });
      candidates.push({ channel: "msedge", path: path.join(root, "Microsoft", "Edge", "Application", "msedge.exe") });
    }
  } else if (platform === "darwin") {
    candidates.push({ channel: "chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
    candidates.push({ channel: "msedge", path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" });
  } else {
    for (const bin of ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome"]) {
      candidates.push({ channel: "chrome", path: bin });
    }
    for (const bin of ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable"]) {
      candidates.push({ channel: "msedge", path: bin });
    }
  }

  const pathVar = env.PATH || env.Path || "";
  const pathDirs = pathVar.split(platform === "win32" ? ";" : ":").map((d) => d.trim()).filter(Boolean);
  const pathBins = PATH_BINARIES[platform] || PATH_BINARIES.linux;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  for (const dir of pathDirs) {
    for (const bin of pathBins) {
      candidates.push({ channel: bin.channel, path: pathApi.join(dir, bin.name) });
    }
  }

  return candidates.find((candidate) => exists(candidate.path)) || null;
}
