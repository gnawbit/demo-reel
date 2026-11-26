import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCommand, parseViewport } from "./lib/options.mjs";
import { launchBrowser, loginAndSave, newContext } from "./lib/browser.mjs";
import { assertConfig } from "./lib/config.mjs";
import { navigate } from "./lib/navigation.mjs";
import { commandError, createReporter, requireInteractiveLogin } from "./lib/report.mjs";
import { resolveTheme } from "./lib/themes.mjs";
import { runPipeline } from "./run.mjs";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function targetKey(event) {
  if (event.selector) return `sel:${event.selector}`;
  if (event.role && event.name) return `role:${event.role}:${event.name}`;
  if (event.name) return `name:${event.name}`;
  if (event.text) return `text:${event.text}`;
  return "";
}

function defaultCaption(event) {
  const label = String(event.label || event.name || event.text || "").replace(/\s+/g, " ").trim().slice(0, 32);
  if (event.action === "type") return label ? `Enter ${label}` : "Enter text";
  if (event.action === "select") return label ? `Choose ${label}` : "Choose option";
  if (event.action === "focus") return label ? `Focus on ${label}` : "Focus on result";
  if (event.action === "click") return label ? `Open ${label}` : "";
  return "";
}

function toStep(event, pause) {
  const step = { action: event.action };
  if (event.selector) step.selector = event.selector;
  else if (event.role) {
    step.role = event.role;
    if (event.name) step.name = event.name;
  } else if (event.name) step.name = event.name;
  else if (event.text) step.text = event.text;

  if (event.action === "type" || event.action === "select") {
    step.value = String(event.value ?? "");
  } else if (event.action === "press") {
    step.key = String(event.key || "Enter");
  } else if (event.action === "wait") {
    step.ms = Number(event.ms || 1000);
    return step;
  }

  if (pause !== undefined) step.pause = pause;
  const caption = event.caption !== undefined ? event.caption : defaultCaption(event);
  if (caption) step.caption = caption;
  if (event.action === "click" && !event.selector && !event.role && !event.name && !event.text) {
    return null;
  }
  return step;
}

export function pushCapturedEvent(merged, item) {
  if (!item || !item.action) return merged;
  const prev = merged.at(-1);
  const currKey = targetKey(item);
  const prevKey = prev ? targetKey(prev) : "";

  // Drop synthetic form-submit click (detail === 0) immediately following Enter press.
  if (
    item.action === "click" &&
    item.syntheticDetail0 &&
    prev?.action === "press" &&
    prev.key === "Enter" &&
    Number.isFinite(item.at) &&
    Number.isFinite(prev.at) &&
    item.at - prev.at <= 120
  ) {
    return merged;
  }

  if (item.action === "type" && prev?.action === "type" && currKey && currKey === prevKey) {
    prev.value = item.value;
    prev.at = item.at ?? prev.at;
    return merged;
  }
  if (item.action === "type" && prev?.action === "click" && prev.isInput && currKey && currKey === prevKey) {
    merged[merged.length - 1] = { ...item };
    return merged;
  }
  if (item.action === "select" && prev?.action === "click" && prev.isSelect && currKey && currKey === prevKey) {
    merged[merged.length - 1] = { ...item };
    return merged;
  }
  if (item.action === "select" && prev?.action === "select" && currKey && currKey === prevKey) {
    prev.value = item.value;
    prev.label = item.label ?? prev.label;
    prev.at = item.at ?? prev.at;
    return merged;
  }
  merged.push({ ...item });
  return merged;
}

export function buildCapturedStory({
  url,
  displayUrl,
  viewport = { width: 1440, height: 810 },
  preset,
  scale = 1,
  rawEvents = [],
}) {
  const merged = [];
  for (const item of rawEvents) {
    pushCapturedEvent(merged, item);
  }

  const steps = [];
  for (let i = 0; i < merged.length; i += 1) {
    const curr = merged[i];
    const next = merged[i + 1];
    let pause;
    if (curr.action !== "wait") {
      if (curr.pause !== undefined) {
        pause = curr.pause;
      } else if (next && Number.isFinite(curr.at) && Number.isFinite(next.at)) {
        const rounded = Math.round((next.at - curr.at) / 100) * 100;
        pause = clamp(rounded, 350, 1800);
      } else {
        pause = curr.action === "focus" ? 1200 : i === merged.length - 1 ? 900 : 600;
      }
    }
    const step = toStep(curr, pause);
    if (step) steps.push(step);
  }

  if (steps.length === 0) {
    steps.push({ action: "wait", ms: 1500 });
  }

  const parsedUrl = new URL(url);
  const theme = resolveTheme({}, preset);
  const story = {
    url: parsedUrl.href,
    displayUrl: displayUrl || parsedUrl.host,
    viewport,
    ...(scale === 2 ? { scale: 2 } : {}),
    initialWait: 700,
    tail: 1200,
    brand: { preset: theme.preset, background: theme.background, accent: theme.accent },
    steps,
  };
  return assertConfig(story, { kind: "story" });
}

function installCaptureScript(context) {
  return context.addInitScript(() => {
    if (window.__tabretakeCaptureInstalled) return;
    window.__tabretakeCaptureInstalled = true;

    const HUD_ID = "__tabretake_capture_hud";
    let focusMode = false;
    let stepCount = 0;
    let lastSummary = "";
    let statusNote = "";

    let hudCountEl;
    let hudFocusBtn;
    let hudNoteEl;
    const syncHud = () => {
      if (hudCountEl) {
        const suffix = lastSummary ? ` · ${lastSummary}` : "";
        hudCountEl.textContent = `Capturing · ${stepCount} step${stepCount === 1 ? "" : "s"}${suffix}`;
      }
      if (hudFocusBtn) {
        hudFocusBtn.textContent = focusMode ? "Click element to focus…" : "Pin focus";
        hudFocusBtn.style.background = focusMode ? "#6c5ce7" : "rgba(255,255,255,0.1)";
      }
      if (hudNoteEl) {
        hudNoteEl.textContent = statusNote;
        hudNoteEl.style.display = statusNote ? "block" : "none";
      }
    };

    const report = async (payload) => {
      if (typeof window.__tabretakeCaptureReport === "function") {
        const res = await window.__tabretakeCaptureReport(payload).catch(() => null);
        if (res && typeof res.count === "number") {
          stepCount = res.count;
          lastSummary = res.lastSummary || "";
          syncHud();
        }
      }
    };

    const isHudEvent = (event) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      return path.some((node) => node && node.id === HUD_ID);
    };

    const escapeAttr = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

    function cssPath(el) {
      if (!el || el.nodeType !== 1) return "";
      if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
        return `#${CSS.escape(el.id)}`;
      }
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && parts.length < 5) {
        let part = node.tagName.toLowerCase();
        if (node.classList && node.classList.length) {
          part += "." + [...node.classList].slice(0, 2).map((c) => CSS.escape(c)).join(".");
        }
        const parent = node.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
          if (siblings.length > 1) {
            part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
          }
        }
        parts.unshift(part);
        if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
          parts[0] = `#${CSS.escape(node.id)}`;
          break;
        }
        node = parent;
      }
      return parts.join(" > ");
    }

    function controlLabel(el) {
      const aria = cleanText(el.getAttribute?.("aria-label"));
      if (aria) return aria;
      if (el.labels?.length) {
        const text = [...el.labels].map((l) => cleanText(l.textContent)).filter(Boolean).join(" ");
        if (text) return text;
      }
      return cleanText(el.getAttribute?.("placeholder")) || cleanText(el.innerText || el.textContent);
    }

    function buildLocator(el) {
      let target = el.closest?.("button, a, input, textarea, select, [role=button], [role=link], [role=tab], [role=textbox], [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']") || el;
      const labelEl = target.closest?.("label");
      if (labelEl?.control && target === el && !["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)) {
        target = labelEl.control;
      }
      for (const attr of ["data-testid", "data-test", "data-cy"]) {
        const val = target.getAttribute?.(attr);
        if (val) {
          const sel = `[${attr}="${escapeAttr(val)}"]`;
          if (document.querySelectorAll(sel).length === 1) return { target, locator: { selector: sel } };
        }
      }
      if (target.id && document.querySelectorAll(`#${CSS.escape(target.id)}`).length === 1) {
        return { target, locator: { selector: `#${CSS.escape(target.id)}` } };
      }
      const tag = target.tagName.toLowerCase();
      const nameAttr = target.getAttribute?.("name");
      if ((tag === "input" || tag === "textarea" || tag === "select") && nameAttr) {
        const sel = `${tag}[name="${escapeAttr(nameAttr)}"]`;
        if (document.querySelectorAll(sel).length === 1) return { target, locator: { selector: sel } };
      }
      const explicitRole = target.getAttribute?.("role");
      const role = explicitRole || (tag === "button" ? "button" : tag === "a" ? "link" : "");
      const text = cleanText(target.innerText || target.getAttribute?.("aria-label"));
      if ((role === "button" || role === "link") && text && text.length <= 40) {
        const candidates = [...document.querySelectorAll("button, a, [role=button], [role=link]")]
          .filter((node) => cleanText(node.innerText || node.getAttribute?.("aria-label")) === text);
        if (candidates.length === 1) {
          return { target, locator: { role, name: text } };
        }
      }
      return { target, locator: { selector: cssPath(target) } };
    }

    const mountHud = () => {
      if (!document.documentElement || document.getElementById(HUD_ID)) return;
      const host = document.createElement("div");
      host.id = HUD_ID;
      let dockedTop = false;
      host.style.cssText = "position:fixed;bottom:14px;right:14px;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          .bar { display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:11px;
            background:rgba(13,17,23,0.92); color:#f1f5f9; border:1px solid rgba(255,255,255,0.14);
            box-shadow:0 12px 32px rgba(0,0,0,0.45); font-size:12px; backdrop-filter:blur(8px); }
          .dot { width:8px; height:8px; border-radius:50%; background:#ef4444; box-shadow:0 0 8px #ef4444; }
          button { border:0; border-radius:7px; padding:4px 8px; color:#f8fafc; background:rgba(255,255,255,0.1);
            cursor:pointer; font:inherit; font-weight:500; white-space:nowrap; }
          button:hover { background:rgba(255,255,255,0.18); }
          .save { background:#10b981; color:#052e16; font-weight:600; }
          .save:hover { background:#34d399; }
          .note { margin-top:6px; padding:6px 10px; border-radius:8px; background:rgba(120,53,15,0.95);
            color:#fef3c7; font-size:11px; max-width:340px; display:none; }
        </style>
        <div class="bar">
          <span class="dot"></span>
          <span id="count">Capturing · 0 steps</span>
          <button id="focus" type="button" title="Alt+F: capture a focus step without clicking through">Pin focus</button>
          <button id="wait" type="button">+ Wait 1s</button>
          <button id="undo" type="button">Undo</button>
          <button id="flip" type="button" title="Move bar to top or bottom">↕</button>
          <button id="save" class="save" type="button">Save &amp; Finish</button>
          <button id="discard" type="button">Discard</button>
        </div>
        <div id="note" class="note"></div>
      `;
      hudCountEl = shadow.getElementById("count");
      hudFocusBtn = shadow.getElementById("focus");
      hudNoteEl = shadow.getElementById("note");
      hudFocusBtn.addEventListener("click", () => { focusMode = !focusMode; syncHud(); });
      shadow.getElementById("flip").addEventListener("click", () => {
        dockedTop = !dockedTop;
        host.style.top = dockedTop ? "14px" : "";
        host.style.bottom = dockedTop ? "" : "14px";
      });
      shadow.getElementById("wait").addEventListener("click", () => {
        stepCount += 1;
        syncHud();
        report({ kind: "step", action: "wait", ms: 1000, at: Date.now() });
      });
      shadow.getElementById("undo").addEventListener("click", () => {
        if (stepCount > 0) stepCount -= 1;
        syncHud();
        report({ kind: "undo" });
      });
      shadow.getElementById("save").addEventListener("click", () => report({ kind: "finish" }));
      shadow.getElementById("discard").addEventListener("click", () => report({ kind: "discard" }));
      document.documentElement.appendChild(host);
      syncHud();
      report({ kind: "ping" });
    };

    if (document.documentElement) mountHud();
    window.addEventListener("DOMContentLoaded", mountHud, true);

    window.addEventListener("keydown", (event) => {
      if (isHudEvent(event)) return;
      if (event.altKey && (event.key === "f" || event.key === "F")) {
        event.preventDefault();
        focusMode = !focusMode;
        syncHud();
        return;
      }
      if (event.key === "Enter" || event.key === "Escape") {
        stepCount += 1;
        syncHud();
        report({ kind: "step", action: "press", key: event.key, at: Date.now() });
      }
    }, true);

    const handleText = (event) => {
      if (isHudEvent(event)) return;
      const el = event.target;
      if (!el || el.nodeType !== 1) return;
      if (el.tagName === "SELECT") return;
      const inputType = (el.getAttribute?.("type") || "").toLowerCase();
      if (inputType === "password") {
        statusNote = "Password input ignored; use --login or --storage-state for authenticated demos.";
        syncHud();
        report({ kind: "password-skipped" });
        return;
      }
      if (inputType === "checkbox" || inputType === "radio" || inputType === "button" || inputType === "submit") {
        return;
      }
      const isEditable = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (!isEditable) return;
      const { target, locator } = buildLocator(el);
      const value = el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? el.value : (el.innerText || "");
      stepCount += 1;
      syncHud();
      report({
        kind: "step",
        action: "type",
        ...locator,
        value,
        label: controlLabel(target).slice(0, 40),
        at: Date.now(),
      });
    };

    document.addEventListener("input", handleText, true);

    document.addEventListener("change", (event) => {
      if (isHudEvent(event)) return;
      const el = event.target;
      if (!el || el.tagName !== "SELECT") return;
      const { target, locator } = buildLocator(el);
      const selectedOption = target.options?.[target.selectedIndex];
      const optionLabel = cleanText(selectedOption?.label || selectedOption?.textContent || target.value);
      stepCount += 1;
      syncHud();
      report({
        kind: "step",
        action: "select",
        ...locator,
        value: target.value,
        label: optionLabel.slice(0, 40),
        at: Date.now(),
      });
    }, true);

    document.addEventListener("click", (event) => {
      if (isHudEvent(event)) return;
      const rawTarget = event.target;
      if (!rawTarget || rawTarget.nodeType !== 1) return;
      const { target, locator } = buildLocator(rawTarget);
      if (!locator.selector && !locator.name && !locator.text) return;

      if (focusMode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusMode = false;
        stepCount += 1;
        syncHud();
        report({
          kind: "step",
          action: "focus",
          ...locator,
          label: controlLabel(target).slice(0, 40),
          at: Date.now(),
        });
        return;
      }

      const tag = target.tagName.toLowerCase();
      const inputType = (target.getAttribute?.("type") || "").toLowerCase();
      if (tag === "input" && inputType === "password") return;
      const isInput = (tag === "input" && !["checkbox", "radio", "button", "submit", "reset"].includes(inputType)) ||
        tag === "textarea" || target.isContentEditable;
      const isSelect = tag === "select";

      stepCount += 1;
      syncHud();
      report({
        kind: "step",
        action: "click",
        ...locator,
        isInput,
        isSelect,
        syntheticDetail0: event.detail === 0,
        label: controlLabel(target).slice(0, 40),
        at: Date.now(),
      });
    }, true);
  });
}

export async function runCaptureSession({
  url,
  viewport = { width: 1440, height: 810 },
  preset,
  scale = 1,
  proxy,
  storageState,
  browser: browserMode = "auto",
  headless = false,
  onReady,
  reporter,
} = {}) {
  const rawEvents = [];
  let passwordSkipped = false;
  let discarded = false;
  let settled = false;

  const browser = await launchBrowser({ headless, proxy, browser: browserMode });
  try {
    const context = await newContext(browser, { viewport, storageState });
    let resolveDone;
    const done = new Promise((resolve) => { resolveDone = resolve; });
    const finish = (isDiscarded = false) => {
      if (settled) return;
      settled = true;
      discarded = isDiscarded;
      resolveDone();
    };

    await context.exposeBinding("__tabretakeCaptureReport", (_source, payload) => {
      if (!payload || typeof payload !== "object") return { count: rawEvents.length };
      if (payload.kind === "step") {
        pushCapturedEvent(rawEvents, payload);
      } else if (payload.kind === "undo") {
        rawEvents.pop();
      } else if (payload.kind === "password-skipped") {
        if (!passwordSkipped) {
          passwordSkipped = true;
          reporter?.log("Warning: password inputs are never written to story files; use --login / --storage-state.");
        }
      } else if (payload.kind === "finish") {
        finish(false);
      } else if (payload.kind === "discard") {
        finish(true);
      }
      const last = rawEvents.at(-1);
      const lastSummary = last ? `${last.action}` : "";
      return { count: rawEvents.length, lastSummary };
    });

    await installCaptureScript(context);
    const page = await context.newPage();

    const checkPages = () => {
      if (context.pages().length === 0) finish(false);
    };
    page.on("close", checkPages);
    context.on("page", (extraPage) => extraPage.on("close", checkPages));
    browser.on("disconnected", () => finish(false));

    await navigate(page, url, { allowAuthErrors: Boolean(storageState) });
    if (onReady) {
      await onReady({ page, context, finish });
    }
    await done;
    await context.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }

  if (discarded) return { discarded: true, story: null, passwordSkipped };
  const story = buildCapturedStory({ url, viewport, preset, scale, rawEvents });
  return { discarded: false, story, passwordSkipped };
}

export async function capture(argv) {
  const { values } = parseCommand("capture", argv);
  requireInteractiveLogin(values);
  const reporter = createReporter("capture", values.json);

  if (!values.url) throw new Error("Provide --url https://your-app.com");
  let parsedUrl;
  try {
    parsedUrl = new URL(values.url);
  } catch {
    throw new Error("Use a complete http:// or https:// URL");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Use a complete http:// or https:// URL");
  }

  const outPath = path.resolve(values.out);
  if (!values.force) {
    try {
      await access(outPath);
      throw new Error("Story file already exists; pass --force to overwrite or choose another --out path");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const viewport = parseViewport(values.viewport);
  const scaleInput = values.scale === undefined ? 1 : (values.scale.trim() === "" ? NaN : Number(values.scale));
  if (scaleInput !== 1 && scaleInput !== 2) {
    throw commandError("INVALID_CONFIG", "scale / --scale must be 1 or 2", {
      hint: "Choose 1 (standard) or 2 (HiDPI Retina).",
    });
  }
  if (values.preset) resolveTheme({}, values.preset);

  let storageState = values["storage-state"];
  if (values.login) {
    storageState = await loginAndSave(parsedUrl.href, {
      proxy: values.proxy,
      viewport,
      browser: values.browser,
      statePath: path.resolve(values["save-state"] || "auth.json"),
    });
  }

  reporter.log("Browser opened for interactive capture. Perform your demo steps, then click 'Save & Finish'.");
  const { discarded, story } = await runCaptureSession({
    url: parsedUrl.href,
    viewport,
    preset: values.preset,
    scale: scaleInput,
    proxy: values.proxy,
    storageState,
    browser: values.browser,
    reporter,
  });

  if (discarded || !story) {
    throw commandError("CAPTURE_DISCARDED", "Interactive capture was discarded; no story file was written.", {
      hint: "Re-run capture and click 'Save & Finish' to keep the recorded steps.",
    });
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(story, null, 2) + "\n", values.force ? "utf8" : { flag: "wx" });
  reporter.log(`Saved captured story (${story.steps.length} step(s)): ${outPath}`);

  const artifacts = [{ kind: "story", path: outPath }];
  let extraSummary = {};

  if (values.run) {
    const runResult = await runPipeline({
      ...values,
      config: outPath,
      out: values["media-out"] || "demo",
    }, { reporter });
    artifacts.push(...runResult.artifacts);
    extraSummary = {
      duration: runResult.duration,
      posterAt: runResult.posterAt,
      ...(runResult.eventCount !== undefined ? { eventCount: runResult.eventCount } : {}),
    };
  } else {
    reporter.log(`Next: tabretake run --config ${path.relative(process.cwd(), outPath)} --vertical`);
  }

  await reporter.success({ stepCount: story.steps.length, ...extraSummary, artifacts });
  return outPath;
}
