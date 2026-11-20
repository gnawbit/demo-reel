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

test("rendering preserves brightness, caption timing and valid poster selection", { timeout: 120000 }, async (t) => {
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
    assert.ok(pixel[channel] > 230, `frame overlays must preserve the source brightness, got ${[...pixel]}`);
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

  await t.test("a rapid next caption replaces the previous one in both layouts", async () => {
    await save({ video: "source.mp4", marks: [
      { t: 0, duration: 0, caption: "Wide words across the whole screen before the next caption", zoom: false },
      { t: 0.2, duration: 0, caption: "B", zoom: false },
    ] });
    await exec(process.execPath, [cli, "render", "--config", config, "--out", out, "--no-gif", "--vertical"], {
      windowsHide: true, timeout: 60000,
    });
    for (const [file, top, height] of [["poster.png", 910, 130], ["poster-9x16.png", 1420, 220]]) {
      const { data, info } = await sharp(path.join(out, file)).extract({
        left: 0, top, width: file === "poster.png" ? 1920 : 1080, height,
      }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let centerInk = 0, outsideInk = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < info.width; x++) {
          const i = (y * info.width + x) * 3;
          if (data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220) {
            if (Math.abs(x - info.width / 2) < 100) centerInk++;
            else outsideInk++;
          }
        }
      }
      assert.ok(centerInk > 20, "replacement caption must remain visible after its PNG input ends");
      assert.equal(outsideInk, 0, "earlier wide caption must not linger underneath the next caption");
    }
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
    await save({ video: "source.mp4", marks: [] });
    for (const value of ["-1", "NaN", "Infinity", ""]) {
      await assert.rejects(run(`--zoom-duration=${value}`), /--zoom-duration must be a non-negative number/);
    }
    for (const value of ["0", "NaN", "Infinity", "11"]) {
      await assert.rejects(run(`--zoom=${value}`), /--zoom must be a number/);
    }
    assert.deepEqual(await readFile(path.join(out, "demo-16x9.mp4")), before);
  });
});
