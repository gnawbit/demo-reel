import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { FFMPEG, probe } from "../scripts/lib/ffmpeg.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("demo records its own server and renders complete media", { timeout: 180000 }, async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), "demo-reel-demo-"));
  t.after(() => rm(out, { recursive: true, force: true }));

  const { stdout } = await exec(process.execPath, [
    "bin/demo-reel.mjs", "demo", "--port", "0", "--out", out,
  ], { cwd: root, windowsHide: true, timeout: 150000 });
  const serverUrl = stdout.match(/Demo site: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
  assert.ok(serverUrl, "demo must report the listening URL");
  assert.notEqual(new URL(serverUrl).port, "0", "URL must contain the assigned port");

  const record = JSON.parse(await readFile(path.join(out, "record.json"), "utf8"));
  assert.equal(record.url, serverUrl, "recording must use the server's port");
  assert.deepEqual(record.events.map((event) => event.action), ["click", "type", "click", "click"]);

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
});
