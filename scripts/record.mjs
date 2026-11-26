import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCommand, parseViewport } from "./lib/options.mjs";
import {
  clickAndType,
  dragBy,
  hover,
  installCursor,
  launchBrowser,
  loginAndSave,
  moveAndClick,
  openRecordedPage,
  resolveLocator,
  selectOption,
} from "./lib/browser.mjs";
import { assertConfig, readConfig } from "./lib/config.mjs";
import { commandError, createReporter, requireInteractiveLogin } from "./lib/report.mjs";
import { navigate } from "./lib/navigation.mjs";
import { resolveTheme } from "./lib/themes.mjs";

export async function executeRecord(values, { command = "record", reporter = createReporter(command, Boolean(values?.json)) } = {}) {
  const preview = command === "preview";
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
  const scaleInput = values.scale === undefined
    ? (config.scale ?? 1)
    : (String(values.scale).trim() === "" ? NaN : Number(values.scale));
  if (scaleInput !== 1 && scaleInput !== 2) {
    throw commandError("INVALID_CONFIG", "scale / --scale must be 1 or 2", {
      hint: "Choose 1 (standard) or 2 (HiDPI Retina).",
    });
  }
  const scale = scaleInput;
  assertConfig({ ...config, url, viewport, scale }, { kind: "story" });
  const steps = config.steps || [];
  if (steps.length === 0) throw new Error("Config has no steps");

  const theme = resolveTheme(config.brand, values.preset);

  const outDir = path.resolve(values.out || config.out || "demo");
  const rawDir = path.join(outDir, "raw");
  if (!preview) {
    await mkdir(rawDir, { recursive: true });
    await rm(rawDir, { recursive: true, force: true });
    await mkdir(rawDir, { recursive: true });
  }

  let storageState = values["storage-state"];
  if (values.login) {
    storageState = await loginAndSave(url, {
      proxy: values.proxy,
      viewport,
      browser: values.browser,
      statePath: path.resolve(values["save-state"] || "auth.json"),
    });
  }

  const browser = await launchBrowser({
    headless: preview ? values.headless : !values.headed,
    proxy: values.proxy,
    browser: values.browser,
    scale,
  });

  let videoPath = null;
  let events = [];
  let videoOffset = 0;
  let timelineDuration = 0;

  try {
    const videoStartedAt = Date.now();
    const { context, page } = await openRecordedPage(browser, {
      viewport,
      scale,
      videoDir: preview ? undefined : rawDir,
      storageState,
    });

    await installCursor(page, { accent: theme.accent });

    events = [];

    await navigate(page, url);
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(Number(config.initialWait ?? 700));

    const startedAt = Date.now();
    videoOffset = Math.max(0, (startedAt - videoStartedAt) / 1000);

    for (const [index, step] of steps.entries()) {
      if (preview) reporter.log(`Step ${index + 1}/${steps.length}: ${step.action}`);
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
            const point = await moveAndClick(page, locator, 0, Number(step.timeout ?? 20000));
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
            await page.waitForTimeout(Number(step.pause ?? 700));
            break;
          }

          case "type": {
            const locator = await resolveLocator(page, step);
            const value = String(step.value ?? step.text ?? "");
            const point = await clickAndType(page, locator, value, 0);
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
            await page.waitForTimeout(Number(step.pause ?? 400));
            break;
          }

          case "select": {
            const locator = await resolveLocator(page, step);
            const value = String(step.value ?? step.text ?? "");
            const point = await selectOption(page, locator, value, 0, Number(step.timeout ?? 20000));
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "select",
              x: point.x,
              y: point.y,
              caption: step.caption || "",
              label: value,
            });
            await page.waitForTimeout(Number(step.pause ?? 500));
            break;
          }

          case "hover": {
            const locator = await resolveLocator(page, step);
            const point = await hover(page, locator, 0);
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
            await page.waitForTimeout(Number(step.pause ?? 500));
            break;
          }

          case "focus": {
            const locator = await resolveLocator(page, step);
            await locator.scrollIntoViewIfNeeded({ timeout: Number(step.timeout ?? 20000) });
            const box = await locator.boundingBox();
            if (!box || box.width <= 0 || box.height <= 0) {
              throw commandError("TARGET_NOT_FOUND", "The focus target has no visible area.");
            }
            const focusedAt = Date.now() - startedAt;
            events.push({
              t: focusedAt, tEnd: focusedAt, action: "focus",
              x: box.x + box.width / 2, y: box.y + box.height / 2,
              zoom: step.zoom !== false, caption: step.caption || "",
              label: step.text || step.name || step.selector || "",
            });
            await page.waitForTimeout(Number(step.pause ?? 700));
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
              0,
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
            await page.waitForTimeout(Number(step.pause ?? 600));
            break;
          }

          case "scroll": {
            const y = Number(step.y || 600);
            await page.evaluate((dy) => {
              window.scrollBy({ top: dy, behavior: "smooth" });
            }, y);
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "scroll",
              x: viewport.width / 2,
              y: viewport.height / 2,
              caption: step.caption || "",
            });
            await page.waitForTimeout(Number(step.pause ?? 700));
            break;
          }

          case "press": {
            await page.keyboard.press(step.key || "Enter");
            events.push({
              t,
              tEnd: Date.now() - startedAt,
              zoom: step.zoom !== false,
              action: "press",
              x: viewport.width / 2,
              y: viewport.height / 2,
              caption: step.caption || "",
            });
            await page.waitForTimeout(Number(step.pause ?? 500));
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
            await mkdir(path.dirname(file), { recursive: true });
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
    if (!preview && !videoPath) throw new Error("Playwright did not produce a video");
  } finally {
    await browser.close();
  }

  if (preview) {
    reporter.log(`Preview completed ${steps.length} step(s).`);
    return {
      summary: { duration: timelineDuration, stepCount: steps.length, artifacts: screenshots },
      record: null,
      recordPath: null,
    };
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
  reporter.log(`\nNext: tabretake render --config ${path.relative(process.cwd(), recordPath)}`);
  reporter.log(`      (or pass the original --config path)\n`);

  return {
    summary: {
      duration: timelineDuration,
      eventCount: events.length,
      artifacts: [
        { kind: "video", path: recordingPath },
        { kind: "timeline", path: recordPath },
        ...screenshots,
      ],
    },
    record,
    recordPath,
  };
}

export async function record(argv, command = "record") {
  const { values } = parseCommand(command, argv);
  requireInteractiveLogin(values);
  const reporter = createReporter(command, values.json);
  const result = await executeRecord(values, { command, reporter });
  await reporter.success(result.summary);
  return result.record;
}
