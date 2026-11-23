import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { FFMPEG, probe } from "../scripts/lib/ffmpeg.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("installed package sets up and renders a demo outside its checkout", { timeout: 300000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "tabretake-package-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const consumer = path.join(temp, "consumer app");
  const out = path.join(consumer, "demo");
  await mkdir(consumer);
  assert.ok(process.env.npm_execpath, "Run this integration test with npm test");
  const npm = (args, cwd) => exec(process.execPath, [process.env.npm_execpath, ...args], {
    cwd, windowsHide: true, timeout: 120000,
  });
  const packed = await npm(["pack", "--json", "--pack-destination", temp], root);
  const [pkg] = JSON.parse(packed.stdout);
  assert.equal(pkg.name, "@gnawbit/tabretake");
  for (const required of ["bin/tabretake.mjs", "scripts/setup.mjs", "schemas/story.schema.json", "references/story.md", "references/rendering.md", "agents/openai.yaml", "examples/story.json", "examples/stories/readme.json", "examples/stories/release.json", "examples/site/index.html", "SKILL.md"]) {
    assert.ok(pkg.files.some((file) => file.path === required), `${required} must be packaged`);
  }
  assert.equal(pkg.files.some((file) => /^(?:\.serena|\.github|tests|demo|docs)\//.test(file.path)), false);
  assert.equal(pkg.files.some((file) => /(?:^|\/)(?:AGENTS(?:\.local)?\.md|auth\.json|\.env(?:\..*)?)$/.test(file.path)), false);
  await npm(["install", "--no-audit", "--no-fund", "--package-lock=false", path.join(temp, pkg.filename)], consumer);
  const installedCli = path.join(consumer, "node_modules", "@gnawbit", "tabretake", "bin", "tabretake.mjs");
  const installedVersion = await npm(["exec", "--offline", "--", "tabretake", "--version"], consumer);
  assert.equal(installedVersion.stdout.trim(), pkg.version);
  const capabilities = await exec(process.execPath, [installedCli, "capabilities", "--json"], { cwd: consumer, windowsHide: true });
  assert.equal(JSON.parse(capabilities.stdout).commands.render.json, true);
  const installedStory = path.join(consumer, "node_modules", "@gnawbit", "tabretake", "examples", "story.json");
  const validation = await exec(process.execPath, [installedCli, "validate", "--config", installedStory, "--json"], {
    cwd: consumer, windowsHide: true,
  });
  assert.equal(JSON.parse(validation.stdout).ok, true);
  await exec(process.execPath, [installedCli, "setup"], {
    cwd: consumer, windowsHide: true, timeout: 60000,
  });

  const { stdout } = await exec(process.execPath, [
    installedCli, "demo", "--port", "0",
  ], { cwd: consumer, windowsHide: true, timeout: 150000 });
  const serverUrl = stdout.match(/Demo site: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
  assert.ok(serverUrl, "demo must report the listening URL");
  assert.notEqual(new URL(serverUrl).port, "0", "URL must contain the assigned port");

  const record = JSON.parse(await readFile(path.join(out, "record.json"), "utf8"));
  assert.equal(record.url, serverUrl, "recording must use the server's port");
  assert.deepEqual(record.events.map((event) => event.action), ["click", "type", "click", "click"]);

  await verifyOutput(out);
  for (const [story, project] of [["readme", "Launch plan"], ["release", "Release notes"]]) {
    await t.test(`installed ${story} story reaches its result`, async () => {
      const storyOut = path.join(consumer, story);
      await exec(process.execPath, [
        installedCli, "demo", "--story", story, "--port", "0", "--out", storyOut,
      ], { cwd: consumer, windowsHide: true, timeout: 150000 });
      const timeline = JSON.parse(await readFile(path.join(storyOut, "record.json"), "utf8"));
      assert.ok(timeline.events.some((event) => event.action === "type" && event.label === project));
      // Each story waits for its created card; recording fails if the flow breaks.
      await verifyOutput(storyOut);
    });
  }
  await assert.rejects(exec(process.execPath, [
    installedCli, "demo", "--story", "../unknown", "--port", "not-a-port",
  ], { cwd: consumer, windowsHide: true }), /Unknown demo story/);
});

async function verifyOutput(out) {
  for (const [video, gif, poster, width, height] of [
    ["demo-16x9.mp4", "demo.gif", "poster.png", 1920, 1080],
    ["demo-9x16.mp4", "demo-9x16.gif", "poster-9x16.png", 1080, 1920],
  ]) {
    const videoPath = path.join(out, video);
    const info = await probe(videoPath);
    const stream = info.streams.find((item) => item.codec_type === "video");
    assert.equal(stream.codec_name, "h264");
    assert.equal(stream.width, width);
    assert.equal(stream.height, height);
    assert.equal(stream.r_frame_rate, "30/1");
    assert.ok(Number(info.format.duration) > 5, "video must contain the recorded story");
    await exec(FFMPEG, ["-v", "error", "-xerror", "-i", videoPath, "-f", "null", "-"], {
      windowsHide: true, timeout: 30000,
    });

    const gifInfo = await sharp(path.join(out, gif)).metadata();
    assert.equal(gifInfo.format, "gif");
    assert.equal(gifInfo.width, width / 2);
    assert.equal(gifInfo.height, height / 2);
    assert.ok(gifInfo.pages > 1, "GIF must be animated");

    const posterImage = sharp(path.join(out, poster));
    const posterInfo = await posterImage.metadata();
    assert.equal(posterInfo.width, width);
    assert.equal(posterInfo.height, height);
    const stats = await posterImage.stats();
    assert.ok(stats.channels.some((channel) => channel.stdev > 1), "poster must not be blank");
  }
}
