import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCommand } from "./lib/options.mjs";
import {
  clickAndType,
  dragBy,
  hover,
  installCursor,
  launchBrowser,
  moveAndClick,
  newContext,
  resolveLocator,
} from "./lib/browser.mjs";
import { waitForEnter } from "./lib/tty.mjs";
import { assertConfig, readConfig } from "./lib/config.mjs";
import { commandError, createReporter, requireInteractiveLogin } from "./lib/report.mjs";
import { navigate } from "./lib/navigation.mjs";

function parseViewport(value, fallback = { width: 1440, height: 810 }) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*x[1-9]\d*$/.test(value)) throw new Error("--viewport must be WIDTHxHEIGHT with positive integers");
  const [width, height] = value.split("x").map(Number);
  return { width, height };
}

export async function record(argv) {
  const { values } = parseCommand("record", argv);
  requireInteractiveLogin(values);
  const reporter = createReporter("record", values.json);
  const screenshots = [];

  if (!values.config && !values.url) {
    throw new Error("Provide --config demo.json (or at least --url)");
  }

  const configPath = values.config ? path.resolve(values.config) : null;
  const config = configPath
    ? await readConfig(configPath)
    : {};

  assertConfig({ ...config, ...(values.url ? { url: values.url } : {}) }, { kind: "story" });
  const url = values.url || config.url;
  if (!url) throw new Error("Missing url in config or --url");

  const viewport = parseViewport(values.viewport, config.viewport || {
    width: 1440,
    height: 810,
  });
  assertConfig({ ...config, url, viewport }, { kind: "story" });
  const scale = 1;
  const steps = config.steps || [];
  if (steps.length === 0) throw new Error("Config has no steps");

  const outDir = path.resolve(values.out || config.out || "demo");
  const rawDir = path.join(outDir, "raw");
  await mkdir(rawDir, { recursive: true });
  await rm(rawDir, { recursive: true, force: true });
  await mkdir(rawDir, { recursive: true });

  let storageState = values["storage-state"];
  if (values.login) {
    storageState = await loginAndSave(url, {
      proxy: values.proxy,
      viewport,
      statePath: path.resolve(values["save-state"] || "auth.json"),
    });
  }

  const browser = await launchBrowser({
    headless: !values.headed,
    proxy: values.proxy,
  });

  let videoPath = null;
  let events = [];
  let videoOffset = 0;
  let timelineDuration = 0;

  try {
    const videoStartedAt = Date.now();
    const context = await newContext(browser, {
      viewport,
      videoDir: rawDir,
      storageState,
    });
    const page = await context.newPage();

    await installCursor(page);

    events = [];

    await navigate(page, url);
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(Number(config.initialWait ?? 700));

    const startedAt = Date.now();
    videoOffset = Math.max(0, (startedAt - videoStartedAt) / 1000);

    for (const [index, step] of steps.entries()) {
      const t = Date.now() - startedAt;

      try {
        switch (step.action) {
          case "wait": {
            await page.waitForTimeout(Number(step.ms || 500));
            break;
          }

          case "goto": {
            await navigate(page, step.url || url);
            await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(Number(step.pause || 500));
            break;
          }

          case "click": {
            const locator = await resolveLocator(page, step);
            const point = await moveAndClick(page, locator, Number(step.pause ?? 700));
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "click",
              x: point.x,
              y: point.y,
              caption: step.caption || "",
              label: step.text || step.name || step.selector || "",
            });
            break;
          }

          case "type": {
            const locator = await resolveLocator(page, step);
            const value = String(step.value ?? step.text ?? "");
            const point = await clickAndType(page, locator, value, Number(step.pause ?? 400));
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "type",
              x: point.x,
              y: point.y,
              caption: step.caption || "",
              label: value,
            });
            break;
          }

          case "hover": {
            const locator = await resolveLocator(page, step);
            const point = await hover(page, locator, Number(step.pause ?? 500));
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "hover",
              x: point.x,
              y: point.y,
              caption: step.caption || "",
              label: step.text || step.selector || "",
            });
            break;
          }

          case "drag": {
            const locator = await resolveLocator(page, step);
            const point = await dragBy(
              page,
              locator,
              Number(step.dx || 0),
              Number(step.dy || 0),
              Number(step.steps || 24),
              Number(step.pause ?? 600),
            );
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "drag",
              x: point.x,
              y: point.y,
              caption: step.caption || "",
              label: step.selector || "",
            });
            break;
          }

          case "scroll": {
            const y = Number(step.y || 600);
            await page.evaluate((dy) => {
              window.scrollBy({ top: dy, behavior: "smooth" });
            }, y);
            await page.waitForTimeout(Number(step.pause ?? 700));
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "scroll",
              x: viewport.width / 2,
              y: viewport.height / 2,
              caption: step.caption || "",
            });
            break;
          }

          case "press": {
            await page.keyboard.press(step.key || "Enter");
            await page.waitForTimeout(Number(step.pause ?? 500));
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "press",
              x: viewport.width / 2,
              y: viewport.height / 2,
              caption: step.caption || "",
            });
            break;
          }

          case "waitFor": {
            if (step.url) {
              await page.waitForURL(step.url, { timeout: Number(step.timeout || 20000) });
            } else if (step.selector) {
              await page.waitForSelector(step.selector, {
                state: "visible",
                timeout: Number(step.timeout || 20000),
              });
            } else if (step.text) {
              await page.getByText(step.text, { exact: false }).first().waitFor({
                state: "visible",
                timeout: Number(step.timeout || 20000),
              });
            }
            await page.waitForTimeout(Number(step.pause ?? 300));
            break;
          }

          case "screenshot": {
            const file = path.join(outDir, step.file || `shot-${Date.now()}.png`);
            await page.screenshot({ path: file });
            screenshots.push({ kind: "screenshot", path: file });
            reporter.log(`Screenshot: ${file}`);
            break;
          }

          default:
            throw new Error(`Unknown step action: ${step.action}`);
        }
      } catch (error) {
        const navigationError = ["PAGE_UNREACHABLE", "PAGE_HTTP_ERROR"].includes(error.code);
        throw commandError(navigationError ? error.code : error.code === "TARGET_NOT_FOUND" ? "TARGET_NOT_FOUND" :
          error.name === "TimeoutError" ? "STEP_TIMEOUT" : "STEP_FAILED",
        navigationError ? error.message : `Could not complete step ${index + 1} (${step.action}).`, {
          step: { index, action: step.action, path: `/steps/${index}` },
          ...(navigationError && error.status ? { status: error.status } : {}),
          hint: navigationError ? error.hint : "Re-run plan with the same login state, check this step's target or wait condition, then retry record.",
        });
      }
    }

    await page.waitForTimeout(Number(config.tail ?? 1200));
    timelineDuration = (Date.now() - startedAt) / 1000;

    const video = page.video();
    await page.close();
    await context.close();

    videoPath = video ? await video.path() : null;
    if (!videoPath) throw new Error("Playwright did not produce a video");
  } finally {
    await browser.close();
  }

  const recordingPath = path.join(outDir, "recording.webm");
  await copyFile(videoPath, recordingPath);

  const recordPath = path.join(outDir, "record.json");
  const record = {
    config,
    url,
    viewport,
    scale,
    video: path.basename(recordingPath),
    videoOffset,
    duration: timelineDuration,
    events,
    recordedAt: new Date().toISOString(),
  };
  await writeFile(recordPath, JSON.stringify(record, null, 2), "utf8");

  reporter.log(`\nRecorded ${events.length} interaction(s).`);
  reporter.log(`Video:   ${recordingPath}`);
  reporter.log(`Record:  ${recordPath}`);
  reporter.log(`\nNext: demo-reel render --config ${path.relative(process.cwd(), recordPath)}`);
  reporter.log(`      (or pass the original --config path)\n`);
  await reporter.success({ duration: timelineDuration, eventCount: events.length, artifacts: [
    { kind: "video", path: recordingPath }, { kind: "timeline", path: recordPath }, ...screenshots,
  ] });

  return record;
}

async function loginAndSave(url, { proxy, viewport, statePath }) {
  const browser = await launchBrowser({ headless: false, proxy });
  try {
    const context = await newContext(browser, { viewport });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
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
