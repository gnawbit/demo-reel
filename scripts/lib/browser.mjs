import { chromium } from "playwright";

export async function launchBrowser({ headless = true, proxy } = {}) {
  return chromium.launch({
    headless,
    proxy: proxy ? { server: proxy } : undefined,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

export async function newContext(browser, options) {
  const {
    viewport = { width: 1440, height: 810 },
    videoDir,
    storageState,
  } = options;

  const context = await browser.newContext({
    viewport,
    storageState: storageState || undefined,
    recordVideo: videoDir
      ? {
          dir: videoDir,
          size: { width: viewport.width, height: viewport.height },
        }
      : undefined,
  });

  return context;
}

/**
 * Draws a fake cursor + click ripple on top of the page, so the recording
 * looks like a human is using it.
 */
export async function installCursor(page) {
  await page.addInitScript(() => {
    if (window.__demoReelCursorInstalled) return;
    window.__demoReelCursorInstalled = true;

    const CSS = `
      #__demo_reel_cursor {
        position: fixed; left: 0; top: 0; width: 22px; height: 22px;
        z-index: 2147483647; pointer-events: none; will-change: transform;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
      }
      #__demo_reel_ripple {
        position: fixed; width: 14px; height: 14px; border-radius: 50%;
        background: rgba(108,92,231,.35); border: 2px solid rgba(255,255,255,.9);
        z-index: 2147483646; pointer-events: none;
        transform: translate(-50%,-50%) scale(.2); opacity: 0;
      }
    `;

    const style = document.createElement("style");
    style.textContent = CSS;
    document.documentElement.appendChild(style);

    const cursor = document.createElement("div");
    cursor.id = "__demo_reel_cursor";
    cursor.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 2L20.5 12.2L12.6 13.7L9.1 21.2L4 2Z"
              fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>`;
    document.documentElement.appendChild(cursor);

    const move = (x, y) => {
      cursor.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
    };

    const ripple = (x, y) => {
      const r = document.createElement("div");
      r.id = "__demo_reel_ripple";
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      document.documentElement.appendChild(r);
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
    move(window.innerWidth / 2, window.innerHeight / 2);
  });
}

export async function resolveLocator(page, step) {
  const candidates = [];

  if (step.selector) candidates.push(page.locator(step.selector));

  if (step.role) {
    candidates.push(
      page.getByRole(step.role, { name: step.name || step.text, exact: false }),
    );
  }

  if (step.name) {
    candidates.push(page.getByRole("button", { name: step.name, exact: false }));
    candidates.push(page.getByRole("link", { name: step.name, exact: false }));
  }

  if (step.text) {
    candidates.push(page.getByRole("button", { name: step.text, exact: false }));
    candidates.push(page.getByRole("link", { name: step.text, exact: false }));
    candidates.push(page.getByText(step.text, { exact: false }));
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

  throw new Error(`Could not find a visible element for step: ${JSON.stringify(step)}`);
}

export async function moveAndClick(page, locator, pause = 700) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y, { steps: 18 });
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  await page.waitForTimeout(pause);

  return { x, y };
}

export async function clickAndType(page, locator, text, pause = 500) {
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

export async function hover(page, locator, pause = 500) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 16 });
  await page.waitForTimeout(pause);
  return { x, y };
}
