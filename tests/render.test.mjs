import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { ffmpeg } from "../scripts/lib/ffmpeg.mjs";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/demo-reel.mjs", import.meta.url));

test("poster selection uses output frames and validates times before rendering", { timeout: 120000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "demo-reel-posters-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, "source.mp4");
  await ffmpeg([
    "-f", "lavfi", "-i", "color=c=red:s=320x180:r=30:d=0.3",
    "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=30:d=0.3",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
    "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", source,
  ]);
  const config = path.join(temp, "story.json");
  const out = path.join(temp, "output");
  const save = (value) => writeFile(config, JSON.stringify(value));
  const run = (...args) => exec(process.execPath, [
    cli, "render", "--config", config, "--out", out, "--no-gif", "--no-captions", ...args,
  ], { windowsHide: true, timeout: 60000 });
  const expectColor = async (file, width, height, channel) => {
    const image = sharp(path.join(out, file));
    const metadata = await image.metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    const pixel = await image.extract({ left: width / 2, top: height / 2, width: 1, height: 1 })
      .removeAlpha().raw().toBuffer();
    assert.ok(pixel[channel] > 150, `expected channel ${channel}, got ${[...pixel]}`);
    assert.ok(pixel[channel === 0 ? 2 : 0] < 30, `unexpected color: ${[...pixel]}`);
  };

  await t.test("short clips get a result poster in both layouts", async () => {
    await save({ video: "source.mp4", marks: [] });
    await run("--vertical");
    await expectColor("poster.png", 1920, 1080, 2);
    await expectColor("poster-9x16.png", 1080, 1920, 2);
  });

  await t.test("marks config can select the first frame", async () => {
    await save({ video: "source.mp4", marks: [], posterAt: 0 });
    await run();
    await expectColor("poster.png", 1920, 1080, 0);
  });

  await t.test("CLI overrides a saved timeline and accepts its last frame", async () => {
    await save({ video: "source.mp4", duration: 0.6, events: [], config: { posterAt: 0 } });
    await run("--poster-at", "0.599");
    await expectColor("poster.png", 1920, 1080, 2);
  });

  await t.test("invalid times preserve existing output", async () => {
    const before = await readFile(path.join(out, "demo-16x9.mp4"));
    for (const value of ["-1", "0.6", "NaN", "Infinity", ""]) {
      await assert.rejects(run(`--poster-at=${value}`), /posterAt \/ --poster-at must be a number/);
    }
    for (const posterAt of [-1, "0", null, 0.6]) {
      await save({ video: "source.mp4", marks: [], posterAt });
      await assert.rejects(run(), /posterAt \/ --poster-at must be a number/);
    }
    assert.deepEqual(await readFile(path.join(out, "demo-16x9.mp4")), before);
  });
});
