import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCommand, parseHttpUrl } from "./lib/options.mjs";
import { createReporter } from "./lib/report.mjs";
import { resolveTheme } from "./lib/themes.mjs";
import { extractPlan } from "./plan.mjs";

function scoreElement(el) {
  const hints = el._hints || {};
  let score = 0;
  if (hints.isDestructive) score -= 100;
  if (hints.emptyHref) score -= 80;
  if (hints.hiddenContainer) score -= 90;
  if (hints.inNav) score -= 40;
  if (hints.inMain) score += 30;
  if (hints.inForm) score += 25;
  if (hints.isPrimary) score += 45;
  if (hints.isSearch && !hints.inForm) score -= 15;
  if (el.tag === "button" || el.role === "button") score += 20;
  if (el.tag === "input" || el.tag === "textarea" || el.role === "textbox") score += 25;
  if (el.tag === "select") score += 22;
  if (el.text || el.label) score += 5;
  return score;
}

function buildAutoSteps(elements) {
  const steps = [{ action: "wait", ms: 600 }];
  const interactive = (elements || [])
    .filter((el) => {
      if (el.type === "password" || el.type === "hidden" || el.type === "checkbox" || el.type === "radio") return false;
      if (el._hints?.isDestructive || el._hints?.emptyHref) return false;
      return Boolean(el.selector && (el.text || el.label || el.placeholder || el.name));
    })
    .map((el, index) => ({ el, index, score: scoreElement(el) }));

  const isTextInput = (el) =>
    el.tag === "input" || el.tag === "textarea" || el.role === "textbox";
  const isSelect = (el) => el.tag === "select" && Array.isArray(el.options) &&
    el.options.some((o) => !o.disabled && o.value !== "");
  const isButton = (el) =>
    el.tag === "button" || el.tag === "a" || el.role === "button" || el.role === "link";

  const byScoreThenOrder = (a, b) => (b.score - a.score) || (a.index - b.index);
  const inputs = interactive.filter(({ el }) => isTextInput(el)).sort(byScoreThenOrder);
  const selects = interactive.filter(({ el }) => isSelect(el)).sort(byScoreThenOrder);
  const buttons = interactive.filter(({ el }) => isButton(el)).sort(byScoreThenOrder);

  const chosen = [];
  const addChosen = (entry) => {
    if (!entry || chosen.length >= 3) return;
    if (!chosen.some((c) => c.el.selector === entry.el.selector)) {
      chosen.push(entry);
    }
  };

  // Prefer primary non-search inputs first; if only topbar search exists and a primary CTA exists, put the primary CTA first.
  const primaryBtn = buttons.find(({ el }) => el._hints?.isPrimary && !el._hints?.inNav);
  const nonSearchInput = inputs.find(({ el }) => !el._hints?.isSearch);
  if (nonSearchInput) {
    addChosen(nonSearchInput);
    addChosen(selects[0]);
    addChosen(primaryBtn || buttons[0]);
  } else {
    addChosen(primaryBtn);
    addChosen(selects[0]);
    addChosen(inputs[0]);
    for (const btn of buttons) addChosen(btn);
  }
  for (const item of [...interactive].sort(byScoreThenOrder)) {
    addChosen(item);
  }

  for (const [idx, { el }] of chosen.sort((a, b) => a.index - b.index).entries()) {
    if (isTextInput(el)) {
      const caption = el.label || el.placeholder || (el.name ? `Enter ${el.name}` : "Input demo text");
      steps.push({
        action: "type",
        selector: el.selector,
        value: "Test drive",
        pause: 400,
        caption: `Input: ${caption}`,
      });
    } else if (isSelect(el)) {
      const opt = el.options.find((o) => !o.disabled && o.value !== "") || el.options.find((o) => !o.disabled);
      const caption = el.label || opt?.label || "Choose option";
      steps.push({
        action: "select",
        selector: el.selector,
        value: opt.value,
        pause: 500,
        caption: `Select: ${caption}`,
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
    steps.push({ action: "wait", ms: idx === chosen.length - 1 ? 1200 : 600 });
  }

  if (steps.length === 1) {
    steps.push({ action: "wait", ms: 1500 });
  }
  return steps;
}

export async function init(argv) {
  const { values } = parseCommand("init", argv);
  const reporter = createReporter("init", values.json);

  const url = parseHttpUrl(values.url);

  let steps = [{ action: "wait", ms: 1500 }];
  if (values.auto) {
    reporter.log("Scanning page to generate interactive steps (--auto)...");
    try {
      const { elements } = await extractPlan(url.href, { browser: values.browser, includeHints: true });
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
