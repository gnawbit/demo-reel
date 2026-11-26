import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCommand, parseViewport } from "./lib/options.mjs";
import { launchBrowser, loginAndSave, newContext } from "./lib/browser.mjs";
import { createReporter, requireInteractiveLogin } from "./lib/report.mjs";
import { navigate } from "./lib/navigation.mjs";

export async function collectElements(page, { includeHints = false } = {}) {
  return page.evaluate((withHints) => {
    function cssPath(el) {
      if (!el || el.nodeType !== 1) return "";
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && parts.length < 5) {
        let part = node.tagName.toLowerCase();
        if (node.classList && node.classList.length) {
          part +=
            "." +
            [...node.classList]
              .slice(0, 2)
              .map((c) => CSS.escape(c))
              .join(".");
        }
        const parent = node.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter(
            (c) => c.tagName === node.tagName,
          );
          if (siblings.length > 1) {
            part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
          }
        }
        parts.unshift(part);
        if (node.id) {
          parts[0] = `#${CSS.escape(node.id)}`;
          break;
        }
        node = parent;
      }
      return parts.join(" > ");
    }

    function normalizeText(value) {
      return (value || "").replace(/\s+/g, " ").trim();
    }

    function labelText(node) {
      if (!node) return "";
      const copy = node.cloneNode(true);
      copy.querySelectorAll("input, textarea, select, button, script, style")
        .forEach((control) => control.remove());
      return normalizeText(copy.textContent);
    }

    function controlLabel(el) {
      const referenced = (el.getAttribute("aria-labelledby") || "")
        .split(/\s+/).filter(Boolean)
        .map((id) => labelText(document.getElementById(id))).filter(Boolean)
        .join(" ");
      return referenced || normalizeText(el.getAttribute("aria-label")) ||
        [...(el.labels || [])].map(labelText).filter(Boolean).join(" ");
    }

    const nodes = [
      ...document.querySelectorAll(
        'a, button, input, textarea, select, [role=button], [role=link], [role=tab], [role=textbox], [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]',
      ),
    ];

    return nodes
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const visible =
          rect.width > 2 &&
          rect.height > 2 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity || 1) > 0.05;

        const label = controlLabel(el);
        const text = (
          label || el.innerText ||
          (el.type === "password" ? "" : el.value) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("title") ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 140);

        const item = {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || "",
          role: el.getAttribute("role") || "",
          text,
          label,
          name: el.getAttribute("name") || "",
          placeholder: el.getAttribute("placeholder") || "",
          ...(el.tagName === "SELECT" ? {
            options: [...el.options].map((option) => ({
              label: normalizeText(option.label),
              value: option.value,
              disabled: el.matches(":disabled") || option.disabled ||
                Boolean(option.closest("optgroup")?.disabled),
            })),
          } : {}),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          selector: cssPath(el),
          visible,
        };
        if (withHints) {
          const rawHref = el.tagName === "A" ? (el.getAttribute("href") || "").trim() : "";
          const hintSource = `${text} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""}`;
          const cls = typeof el.className === "string" ? el.className : "";
          item._hints = {
            inNav: Boolean(el.closest("nav, aside, footer, [role=navigation]")),
            inMain: Boolean(el.closest("main, form, [role=main], [role=dialog]")),
            inForm: Boolean(el.closest("form")),
            hiddenContainer: Boolean(el.closest("[aria-hidden='true'], [inert]")) || style.pointerEvents === "none",
            emptyHref: el.tagName === "A" && (!rawHref || rawHref === "#" || rawHref.startsWith("javascript:")),
            isPrimary: el.getAttribute("type") === "submit" ||
              /\b(primary|cta|submit|create|new|add|start|save|launch)\b/i.test(`${cls} ${text}`),
            isDestructive: /\b(delete|remove|destroy|logout|log out|sign out|cancel|close|reset|clear)\b/i.test(hintSource),
            isSearch: el.getAttribute("type") === "search" || /\bsearch\b/i.test(hintSource),
          };
        }
        return item;
      })
      .filter((el) => el.visible)
      .slice(0, 300);
  }, includeHints);
}

export async function extractPlan(url, {
  viewport = { width: 1440, height: 810 },
  proxy,
  storageState,
  headless = true,
  browser: browserMode,
  includeHints = false,
} = {}) {
  const browser = await launchBrowser({ headless, proxy, browser: browserMode });
  try {
    const context = await newContext(browser, { viewport, storageState });
    const page = await context.newPage();
    await navigate(page, url);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const title = await page.title();
    const elements = await collectElements(page, { includeHints });
    await context.close();
    return { title, elements };
  } finally {
    await browser.close();
  }
}

export async function plan(argv) {
  const { values } = parseCommand("plan", argv);
  requireInteractiveLogin(values);
  const reporter = createReporter("plan", values.json);

  if (!values.url) throw new Error("Missing --url");

  const viewport = parseViewport(values.viewport);
  const outPath = path.resolve(values.out);
  const outDir = path.dirname(outPath);

  await mkdir(outDir, { recursive: true });

  let storageState = values["storage-state"];
  if (values.login) {
    storageState = await loginAndSave(values.url, { proxy: values.proxy, viewport, browser: values.browser });
  }

  const browser = await launchBrowser({
    headless: values.headless || !values.login,
    proxy: values.proxy,
    browser: values.browser,
  });

  let manifest;
  try {
    const context = await newContext(browser, { viewport, storageState });
    const page = await context.newPage();

    await navigate(page, values.url);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);

    const screenshotPath = path.join(outDir, "plan.png");
    await page.screenshot({ path: screenshotPath });

    const title = await page.title();
    const elements = await collectElements(page);

    const result = {
      url: values.url,
      title,
      viewport,
      screenshot: screenshotPath,
      generatedAt: new Date().toISOString(),
      elements,
    };

    await writeFile(outPath, JSON.stringify(result, null, 2), "utf8");

    reporter.log(`\nSaved plan to ${outPath}`);
    reporter.log(`Screenshot: ${screenshotPath}`);
    if (!values.json) reporter.log(`Title: ${title}`);
    reporter.log(`Interactive elements: ${elements.length}\n`);
    for (const el of elements.slice(0, 25)) {
      const label = el.text || el.placeholder || el.name || "(no text)";
      if (!values.json) reporter.log(
        `  <${el.tag}${el.type ? ` type=${el.type}` : ""}> ${JSON.stringify(label)}  @ ${el.selector}`,
      );
    }
    if (!values.json && elements.length > 25) reporter.log(`  ... and ${elements.length - 25} more`);

    await context.close();
    manifest = { elementCount: elements.length, artifacts: [
      { kind: "plan", path: outPath }, { kind: "screenshot", path: screenshotPath },
    ] };
  } finally {
    await browser.close();
  }
  await reporter.success(manifest);
}
