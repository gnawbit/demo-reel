import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { launchBrowser, newContext } from "./lib/browser.mjs";
import { waitForEnter } from "./lib/tty.mjs";

function parseViewport(value) {
  if (!value) return { width: 1440, height: 810 };
  const [w, h] = value.split("x").map(Number);
  return { width: w || 1440, height: h || 810 };
}

export async function plan(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      out: { type: "string", default: "plan.json" },
      login: { type: "boolean", default: false },
      "storage-state": { type: "string" },
      proxy: { type: "string" },
      viewport: { type: "string" },
      headless: { type: "boolean", default: true },
    },
  });

  if (!values.url) throw new Error("Missing --url");

  const viewport = parseViewport(values.viewport);
  const outPath = path.resolve(values.out);
  const outDir = path.dirname(outPath);

  await mkdir(outDir, { recursive: true });

  let storageState = values["storage-state"];
  if (values.login) {
    storageState = await loginAndSave(values.url, { proxy: values.proxy, viewport });
  }

  const browser = await launchBrowser({
    headless: values.headless || !values.login,
    proxy: values.proxy,
  });

  try {
    const context = await newContext(browser, { viewport, storageState });
    const page = await context.newPage();

    await page.goto(values.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);

    const screenshotPath = path.join(outDir, "plan.png");
    await page.screenshot({ path: screenshotPath });

    const title = await page.title();
    const elements = await page.evaluate(() => {
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

      const nodes = [
        ...document.querySelectorAll(
          "a, button, input, textarea, select, [role=button], [role=link], [role=tab]",
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

          const text = (
            el.innerText ||
            el.value ||
            el.getAttribute("aria-label") ||
            el.getAttribute("placeholder") ||
            el.getAttribute("title") ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 140);

          return {
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute("type") || "",
            role: el.getAttribute("role") || "",
            text,
            name: el.getAttribute("name") || "",
            placeholder: el.getAttribute("placeholder") || "",
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            selector: cssPath(el),
            visible,
          };
        })
        .filter((el) => el.visible)
        .slice(0, 300);
    });

    const result = {
      url: values.url,
      title,
      viewport,
      screenshot: screenshotPath,
      generatedAt: new Date().toISOString(),
      elements,
    };

    await writeFile(outPath, JSON.stringify(result, null, 2), "utf8");

    console.log(`\nSaved plan to ${outPath}`);
    console.log(`Screenshot: ${screenshotPath}`);
    console.log(`Title: ${title}`);
    console.log(`Interactive elements: ${elements.length}\n`);
    for (const el of elements.slice(0, 25)) {
      const label = el.text || el.placeholder || el.name || "(no text)";
      console.log(
        `  <${el.tag}${el.type ? ` type=${el.type}` : ""}> ${JSON.stringify(label)}  @ ${el.selector}`,
      );
    }
    if (elements.length > 25) console.log(`  ... and ${elements.length - 25} more`);

    await context.close();
  } finally {
    await browser.close();
  }
}

async function loginAndSave(url, { proxy, viewport }) {
  const browser = await launchBrowser({ headless: false, proxy });
  try {
    const context = await newContext(browser, { viewport });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    console.log("\nA browser window is open. Log in, then come back here.");
    await waitForEnter("Press Enter when you are logged in... ");
    const statePath = path.resolve("auth.json");
    await context.storageState({ path: statePath });
    console.log(`Saved login state to ${statePath}\n`);
    await context.close();
    return statePath;
  } finally {
    await browser.close();
  }
}
