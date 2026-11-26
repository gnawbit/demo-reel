import { existsSync } from "node:fs";
import { chmod, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, errors } from "playwright";
import { FFMPEG } from "./ffmpeg.mjs";
import { navigate } from "./navigation.mjs";
import { VALID_BROWSERS, findSystemBrowser } from "./system-browser.mjs";
import { waitForEnter } from "./tty.mjs";

export { VALID_BROWSERS, findSystemBrowser };

export async function launchBrowser({
  headless = true,
  proxy,
  browser = "auto",
  scale = 1,
  launch = (opts) => chromium.launch(opts),
  hasBundledChromium = () => existsSync(chromium.executablePath()),
} = {}) {
  const mode = browser || "auto";
  if (!VALID_BROWSERS.has(mode)) {
    throw new Error(`Unsupported --browser "${mode}". Choose auto, chromium, chrome or msedge.`);
  }

  const args = ["--disable-blink-features=AutomationControlled"];
  if (Number(scale) > 1) {
    args.push(`--force-device-scale-factor=${Number(scale)}`);
  }

  const base = {
    headless,
    proxy: proxy ? { server: proxy } : undefined,
    args,
  };

  if (mode === "chrome" || mode === "msedge") {
    return launch({ ...base, channel: mode });
  }

  if (mode === "chromium" || hasBundledChromium()) {
    return launch(base);
  }

  for (const channel of ["chrome", "msedge"]) {
    try {
      return await launch({ ...base, channel });
    } catch {
      // Continue trying next installed system browser channel.
    }
  }

  return launch(base);
}

export async function newContext(browser, options) {
  const {
    viewport = { width: 1440, height: 810 },
    scale = 1,
    videoDir,
    storageState,
  } = options;
  const deviceScaleFactor = Number(scale) || 1;

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    storageState: storageState || undefined,
    recordVideo: videoDir
      ? {
          dir: videoDir,
          size: {
            width: viewport.width * deviceScaleFactor,
            height: viewport.height * deviceScaleFactor,
          },
        }
      : undefined,
  });

  return context;
}

export async function openRecordedPage(
  browser,
  contextOptions,
  { ffmpegPath = FFMPEG, makeContext = (opts) => newContext(browser, opts) } = {},
) {
  let context = await makeContext(contextOptions);
  try {
    const page = await context.newPage();
    return { context, page };
  } catch (error) {
    const match = /Executable doesn't exist at ([^\r\n]+)/.exec(String(error?.message || ""));
    if (!match || !/Video rendering requires ffmpeg binary/.test(error.message) || !ffmpegPath || !existsSync(ffmpegPath)) {
      await context.close().catch(() => {});
      throw error;
    }
    const targetPath = match[1].trim();
    await context.close().catch(() => {});
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(ffmpegPath, targetPath);
    await chmod(targetPath, 0o755).catch(() => {});
    context = await makeContext(contextOptions);
    const page = await context.newPage();
    return { context, page };
  }
}

function accentRgba(hex, alpha) {
  const clean = String(hex || "#6c5ce7").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgba(108,92,231,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Draws a fake cursor + click ripple on top of the page, so the recording
 * looks like a human is using it.
 */
export async function installCursor(page, { accent = "#6c5ce7" } = {}) {
  const rippleBg = accentRgba(accent, 0.35);
  const rippleBorder = accentRgba(accent, 0.85);
  await page.addInitScript(({ rippleBg, rippleBorder }) => {
    if (window.__tabretakeCursorInstalled) return;
    window.__tabretakeCursorInstalled = true;

    const CSS = `
      #__tabretake_cursor {
        position: fixed; left: 0; top: 0; width: 22px; height: 22px;
        z-index: 2147483647; pointer-events: none; will-change: transform;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
      }
      #__tabretake_ripple {
        position: fixed; width: 14px; height: 14px; border-radius: 50%;
        background: ${rippleBg}; border: 2px solid ${rippleBorder};
        z-index: 2147483646; pointer-events: none;
        transform: translate(-50%,-50%) scale(.2); opacity: 0;
      }
    `;

    const style = document.createElement("style");
    style.textContent = CSS;

    const cursor = document.createElement("div");
    cursor.id = "__tabretake_cursor";
    cursor.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 2L20.5 12.2L12.6 13.7L9.1 21.2L4 2Z"
              fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>`;

    const move = (x, y) => {
      cursor.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
    };

    const mount = () => {
      if (!document.documentElement || document.getElementById("__tabretake_cursor")) return;
      document.documentElement.appendChild(style);
      document.documentElement.appendChild(cursor);
      move(window.innerWidth / 2, window.innerHeight / 2);
    };
    if (document.documentElement) mount();
    window.addEventListener("DOMContentLoaded", mount, { once: true });

    const ripple = (x, y) => {
      const root = document.body || document.documentElement;
      if (!root) return;
      const r = document.createElement("div");
      r.id = "__tabretake_ripple";
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      root.appendChild(r);
      r.animate(
        [
          { transform: "translate(-50%,-50%) scale(.2)", opacity: 1 },
          { transform: "translate(-50%,-50%) scale(2.8)", opacity: 0 },
        ],
        { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      setTimeout(() => r.remove(), 560);
    };

    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY), true);
    window.addEventListener("mousedown", (e) => ripple(e.clientX, e.clientY), true);
  }, { rippleBg, rippleBorder });
}

export async function resolveLocator(page, step) {
  const candidates = [];

  if (step.selector) candidates.push(page.locator(step.selector));

  if (step.role) {
    for (const exact of [true, false]) {
      candidates.push(page.getByRole(step.role, { name: step.name || step.text, exact }));
    }
  } else {
    const names = [...new Set([step.name, step.text].filter(Boolean))];
    // Prefer exact controls, then partial controls, before plain-text fallback.
    for (const exact of [true, false]) {
      for (const name of names) {
        candidates.push(page.getByRole("button", { name, exact }));
        candidates.push(page.getByRole("link", { name, exact }));
      }
    }
    for (const exact of [true, false]) {
      for (const name of names) candidates.push(page.getByText(name, { exact }));
    }
  }

  for (const locator of candidates) {
    try {
      const count = await locator.count();
      for (let i = 0; i < count; i += 1) {
        const item = locator.nth(i);
        if (await item.isVisible().catch(() => false)) return item;
      }
    } catch {
      // try the next candidate
    }
  }

  throw Object.assign(new Error("Could not find a visible element for this step."), { code: "TARGET_NOT_FOUND" });
}

export async function moveAndClick(page, locator, pause = 700, timeout = 20000) {
  const deadline = Date.now() + timeout;
  const remaining = () => {
    const ms = deadline - Date.now();
    if (ms <= 0) throw new errors.TimeoutError("Timed out waiting for an actionable click target.");
    return ms;
  };

  // Wait before measuring: loading overlays or disabled controls may also move.
  await locator.click({ trial: true, timeout: remaining() });
  const box = await locator.boundingBox({ timeout: remaining() });
  if (!box) throw new Error("Element has no bounding box");

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y, { steps: 18 });
  await page.waitForTimeout(120);
  // Recheck actionability at the actual click; never click an overlay by position.
  await locator.click({ delay: 70, timeout: remaining() });
  await page.waitForTimeout(pause);

  return { x, y };
}

export async function clickAndType(page, locator, text, pause = 500) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y, { steps: 16 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);

  await locator.fill("");
  await page.keyboard.type(text, { delay: 45 });
  await page.waitForTimeout(pause);

  return { x, y };
}

export async function dragBy(page, locator, dx, dy = 0, steps = 24, pause = 600) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const endX = x + Number(dx || 0);
  const endY = y + Number(dy || 0);

  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(endX, endY, { steps: Number(steps || 24) });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(pause);

  return { x: endX, y: endY };
}

export async function selectOption(page, locator, value, pause = 500, timeout = 20000) {
  const deadline = Date.now() + timeout;
  const remaining = () => {
    const ms = deadline - Date.now();
    if (ms <= 0) throw new errors.TimeoutError("Timed out waiting for an actionable select target.");
    return ms;
  };
  await locator.waitFor({ state: "visible", timeout: remaining() });
  await locator.scrollIntoViewIfNeeded({ timeout: remaining() });
  const box = await locator.boundingBox({ timeout: remaining() });
  if (!box) throw new Error("Element has no bounding box");

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 16 });
  await page.waitForTimeout(100);

  const target = String(value ?? "");
  const matched = await locator.evaluate((el, raw) => {
    if (el.tagName !== "SELECT") return null;
    const opts = [...el.options];
    const byValue = opts.find((o) => o.value === raw);
    if (byValue) return { value: byValue.value };
    const byLabel = opts.find((o) => (o.label || o.textContent || "").trim() === raw);
    if (byLabel) return { value: byLabel.value };
    return null;
  }, target);

  if (!matched) {
    throw Object.assign(new Error("Could not find a matching option for select step."), { code: "TARGET_NOT_FOUND" });
  }
  await locator.selectOption(matched, { timeout: remaining() });
  await page.waitForTimeout(pause);
  return { x, y };
}

export async function hover(page, locator, pause = 500) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 16 });
  await page.waitForTimeout(pause);
  return { x, y };
}

export async function loginAndSave(url, {
  proxy,
  viewport,
  browser: browserMode,
  statePath = path.resolve("auth.json"),
} = {}) {
  const browser = await launchBrowser({ headless: false, proxy, browser: browserMode });
  try {
    const context = await newContext(browser, { viewport });
    const page = await context.newPage();
    await navigate(page, url, { allowAuthErrors: true });
    console.log("\nA browser window is open. Log in, then come back here.");
    await waitForEnter("Press Enter when you are logged in... ");
    await context.storageState({ path: statePath });
    console.log(`Saved login state to ${statePath}\n`);
    await context.close();
    return statePath;
  } finally {
    await browser.close();
  }
}
