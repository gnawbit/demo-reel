import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { buildCameraFilter } from "../scripts/lib/camera.mjs";
import { ffmpeg } from "../scripts/lib/ffmpeg.mjs";

function marker(frames, index, width = 320, height = 180) {
  const frame = frames.subarray(index * width * height * 3, (index + 1) * width * height * 3);
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (frame[i + 1] > 180 && frame[i] < 80 && frame[i + 2] < 80) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  assert.ok(maxX >= minX, `marker missing at frame ${index}`);
  return { x: (minX + maxX) / 2, w: maxX - minX + 1, h: maxY - minY + 1 };
}

test("camera eases into a click and back without cutting time", { timeout: 60000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "tabretake-camera-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const input = path.join(temp, "input.png");
  await sharp(Buffer.from('<svg width="320" height="180"><rect width="320" height="180" fill="#444"/><rect x="240" y="80" width="20" height="20" fill="#00ff00"/></svg>'))
    .png().toFile(input);
  const draw = async (events, transition, file) => {
    const camera = buildCameraFilter({ events, transition, zoom: 2, durationSec: 2,
      videoW: 320, videoH: 180, contentW: 320, contentH: 180 });
    const out = path.join(temp, file);
    await ffmpeg(["-loop", "1", "-framerate", "30", "-i", input,
      "-vf", camera.filter, "-pix_fmt", "rgb24", "-f", "rawvideo", out]);
    const frames = await readFile(out);
    assert.equal(frames.length, 60 * 320 * 180 * 3, "no timeline frames may be dropped or duplicated");
    return frames;
  };
  const events = [{ t: 500, x: 250, y: 90 }, { t: 1400, zoom: false }];
  const frames = await draw(events, 0.35, "smooth.rgb");
  const before = marker(frames, 14);
  const at = marker(frames, 15);
  const middle = marker(frames, 20);
  const focused = marker(frames, 27);
  const restored = marker(frames, 57);
  assert.ok(Math.abs(at.w - before.w) <= 1, "click must not instantly change the crop");
  assert.ok(middle.w > before.w + 3 && middle.w < focused.w - 3, "zoom must have intermediate frames");
  assert.ok(middle.x < before.x && middle.x > focused.x, "camera must move toward the clicked region");
  assert.ok(Math.abs(restored.w - before.w) <= 1 && Math.abs(restored.x - before.x) <= 1, "zoom:false must return to overview");

  const instant = await draw(events, 0, "instant.rgb");
  assert.ok(marker(instant, 15).w > before.w * 1.8, "zero duration must opt out of easing");

  const rapid = await draw([{ t: 500, x: 250, y: 90 }, { t: 650, zoom: false }], 0.35, "rapid.rgb");
  assert.ok(Math.abs(marker(rapid, 20).w - marker(rapid, 19).w) < 4, "an interrupted transition must continue from its current scale");
});

test("camera preserves shapes when the source aspect ratio differs", { timeout: 60000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "tabretake-aspect-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const input = path.join(temp, "input.png");
  await sharp(Buffer.from('<svg width="320" height="240"><rect width="320" height="240" fill="#444"/><rect x="150" y="110" width="20" height="20" fill="#00ff00"/></svg>'))
    .png().toFile(input);
  const camera = buildCameraFilter({ events: [{ t: 0, x: 160, y: 120 }],
    zoom: 2, transition: 0.35, durationSec: 0.6, videoW: 320, videoH: 240, contentW: 320, contentH: 180 });
  const out = path.join(temp, "aspect.rgb");
  await ffmpeg(["-loop", "1", "-framerate", "30", "-i", input,
    "-vf", camera.filter, "-pix_fmt", "rgb24", "-f", "rawvideo", out]);
  const frames = await readFile(out);
  for (const index of [0, 5, 15]) {
    const box = marker(frames, index);
    assert.ok(Math.abs(box.w - box.h) <= 2, "a square must stay square while zooming");
  }
});
