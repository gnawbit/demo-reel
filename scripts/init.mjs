import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCommand } from "./lib/options.mjs";
import { createReporter } from "./lib/report.mjs";
import { resolveTheme } from "./lib/themes.mjs";
import { extractPlan } from "./plan.mjs";

export function buildAutoSteps(elements) {
  const steps = [{ action: "wait", ms: 600 }];
  const interactive = (elements || []).filter((el) => {
    if (el.type === "password" || el.type === "hidden") return false;
    return Boolean(el.selector && (el.text || el.label || el.placeholder || el.name));
  });

  const inputs = interactive.filter((el) => el.tag === "input" || el.tag === "textarea" || el.role === "textbox");
  const buttons = interactive.filter((el) => el.tag === "button" || el.tag === "a" || el.role === "button" || el.role === "link");

  const chosen = [];
  if (inputs.length > 0) {
    chosen.push(inputs[0]);
  }
  for (const btn of buttons) {
    if (chosen.length >= 3) break;
    if (!chosen.some((c) => c.selector === btn.selector)) {
      chosen.push(btn);
    }
  }
  for (const el of interactive) {
    if (chosen.length >= 3) break;
    if (!chosen.some((c) => c.selector === el.selector)) {
      chosen.push(el);
    }
  }

  for (const el of chosen) {
    if (el.tag === "input" || el.tag === "textarea" || el.role === "textbox") {
      const caption = el.label || el.placeholder || (el.name ? `Enter ${el.name}` : "Input demo text");
      steps.push({
        action: "type",
        selector: el.selector,
        value: "Test drive",
        pause: 400,
        caption: `Input: ${caption}`,
      });
    } else {
      const caption = el.text || el.label || (el.role ? `${el.role}` : "Click target");
      steps.push({
        action: "click",
        selector: el.selector,
        pause: 600,
        caption: `Click: ${caption}`,
      });
    }
    steps.push({ action: "wait", ms: 600 });
  }

  if (steps.length === 1) {
    steps.push({ action: "wait", ms: 1500 });
  } else {
    steps.push({ action: "wait", ms: 1200 });
  }
  return steps;
}

export async function init(argv) {
  const { values } = parseCommand("init", argv);
  const reporter = createReporter("init", values.json);

  if (!values.url) throw new Error("Provide --url https://your-app.com");
  let url;
  try {
    url = new URL(values.url);
  } catch {
    throw new Error("Use a complete http:// or https:// URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Use a complete http:// or https:// URL");
  }

  let steps = [{ action: "wait", ms: 1500 }];
  if (values.auto) {
    reporter.log("Scanning page to generate interactive steps (--auto)...");
    try {
      const { elements } = await extractPlan(url.href, { browser: values.browser });
      steps = buildAutoSteps(elements);
      reporter.log(`Generated ${steps.length} step(s) from discovered interactive controls.`);
    } catch (err) {
      reporter.warn(`Could not scan page for --auto (${err.message}); falling back to starter.`);
    }
  }

  const theme = resolveTheme({}, values.preset);
  const story = {
    url: url.href,
    displayUrl: url.host,
    viewport: { width: 1440, height: 810 },
    initialWait: 700,
    tail: 1200,
    brand: { preset: theme.preset, background: theme.background, accent: theme.accent },
    steps,
  };
  const outPath = path.resolve(values.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  try {
    await writeFile(outPath, JSON.stringify(story, null, 2) + "\n", { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Story file already exists; edit it or choose a different --out path");
    }
    throw error;
  }

  reporter.log(`Created story: ${outPath}`);
  if (!values.auto) {
    reporter.log("The starter records a static page. Use plan to find controls, then add click/type steps.");
  }
  reporter.log("Run record with this config, then render the resulting record.json.");
  await reporter.success({ artifacts: [{ kind: "story", path: outPath }] });
  return outPath;
}
