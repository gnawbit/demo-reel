import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { inspectConfig } from "../scripts/lib/config.mjs";
import { parseHttpUrl, parseScale } from "../scripts/lib/options.mjs";

test("parseHttpUrl and parseScale validate shared CLI option values", () => {
  assert.equal(parseHttpUrl("https://example.com/app").href, "https://example.com/app");
  assert.throws(() => parseHttpUrl(""), /Provide --url/);
  assert.throws(() => parseHttpUrl("not-a-url"), /complete http/);
  assert.throws(() => parseHttpUrl("file:///tmp/a.html"), /complete http/);

  assert.equal(parseScale(undefined, 1), 1);
  assert.equal(parseScale("2", 1), 2);
  assert.throws(() => parseScale("", 1), /scale \/ --scale must be 1 or 2/);
  assert.throws(() => parseScale("3", 1), /scale \/ --scale must be 1 or 2/);
});

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const story = { url: "https://example.com", steps: [{ action: "click", text: "Create" }] };
const run = (args, cwd) => exec(process.execPath, [path.join(root, "bin/tabretake.mjs"), ...args], {
  cwd, windowsHide: true, timeout: 10000,
});

test("bundled stories, marks and recorded timelines validate", async () => {
  const files = ["examples/story.json", "examples/story-video.json",
    ...((await readdir(path.join(root, "examples/stories"))).map((name) => `examples/stories/${name}`))];
  for (const file of files) {
    const result = inspectConfig(JSON.parse(await readFile(path.join(root, file), "utf8")));
    assert.equal(result.ok, true, JSON.stringify({ file, errors: result.errors }));
  }
  assert.equal(inspectConfig({ video: "recording.webm", events: [], config: story }).kind, "record");
  assert.equal(inspectConfig({ marks: [] }).ok, true, "CLI can supply --video later");
  assert.equal(inspectConfig({
    ...story,
    scale: 2,
    brand: { preset: "slate", frame: "phone" },
    steps: [{ action: "select", selector: "#plan", value: "pro" }],
  }).ok, true);
});

test("validation identifies bad fields without coercing or echoing values", () => {
  const cases = [
    [{ ...story, steps: [{ action: "clcik", text: "Create" }] }, "/steps/0/action"],
    [{ ...story, steps: [{ action: "click" }] }, "/steps/0"],
    [{ ...story, steps: [{ action: "waitFor" }] }, "/steps/0"],
    [{ ...story, steps: [{ action: "type", selector: "input" }] }, "/steps/0"],
    [{ ...story, steps: [{ action: "select", selector: "select" }] }, "/steps/0"],
    [{ ...story, scale: 3 }, "/scale"],
    [{ ...story, brand: { frame: "tablet" } }, "/brand/frame"],
    [{ ...story, steps: [{ action: "wait", ms: "100" }] }, "/steps/0/ms"],
    [{ ...story, viewport: { width: 0, height: 720 } }, "/viewport/width"],
    [{ ...story, brand: { preset: "unknown-theme" } }, "/brand/preset"],
    [{ ...story, vertical: { zoom: 0.9 } }, "/vertical/zoom"],
    [{ ...story, vertical: { zoom: "2" } }, "/vertical/zoom"],
    [{ ...story, vertical: { zoom: 11 } }, "/vertical/zoom"],
    [{ ...story, url: "https://" }, "/url"],
    [{ ...story, url: "file:///page.html" }, "/url"],
    [{ ...story, steps: [{ action: "click", text: "Create", captino: "private-value" }] }, "/steps/0/captino"],
    [{ video: "video.mp4", marks: [], duration: 2, posterAt: 2 }, "/posterAt"],
    [{ video: "video.mp4", events: [{ t: 200, tEnd: 100 }] }, "/events/0/tEnd"],
    [null, "/"],
  ];
  for (const [input, field] of cases) {
    const before = JSON.stringify(input);
    const result = inspectConfig(input);
    assert.equal(result.ok, false, before);
    assert.ok(result.errors.some((e) => e.path.startsWith(field)), JSON.stringify(result));
    assert.equal(JSON.stringify(input), before);
    assert.ok(!JSON.stringify(result).includes("private-value"));
  }
});

test("invalid config fails before recording or rendering touches output", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-validation-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const raw = path.join(dir, "output/raw");
  await mkdir(raw, { recursive: true });
  const marker = path.join(raw, "keep.txt");
  await writeFile(marker, "existing recording");
  await writeFile(path.join(dir, "story.json"), JSON.stringify({ ...story, steps: [{ action: "clcik" }] }));
  for (const command of ["record", "render"]) {
    await assert.rejects(run([command, "--config", "story.json", "--out", "output"], dir), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /\/steps\/0\/action/);
      return true;
    });
    assert.equal(await readFile(marker, "utf8"), "existing recording");
    assert.deepEqual(await readdir(path.join(dir, "output")), ["raw"]);
  }
});

test("validate JSON supports success, schema, syntax and file errors", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-validation-json-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "story.json");
  const args = ["validate", "--config", file, "--json"];
  await writeFile(file, JSON.stringify(story));
  const valid = await run(args, dir);
  assert.equal(valid.stderr, "");
  assert.equal(JSON.parse(valid.stdout).ok, true);
  for (const [source, expected] of [[JSON.stringify({ ...story, tail: -1 }), "INVALID_CONFIG"],
    ['{"private-value": unquoted}', "INVALID_JSON"], [null, "CONFIG_READ_FAILED"]]) {
    if (source === null) await rm(file); else await writeFile(file, source);
    await assert.rejects(run(args, dir), (error) => {
      const result = JSON.parse(error.stdout);
      assert.equal(error.code, 1);
      assert.equal(error.stderr, "");
      assert.equal(result.ok, false);
      assert.equal(result.error?.code || result.errors[0].code, expected);
      assert.ok(!error.stdout.includes("private-value"));
      return true;
    });
  }
});
