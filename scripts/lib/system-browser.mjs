import { existsSync } from "node:fs";
import path from "node:path";

export const VALID_BROWSERS = new Set(["auto", "chromium", "chrome", "msedge"]);

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
  return candidates.find((candidate) => exists(candidate.path)) || null;
}
