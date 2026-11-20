import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { createCaptionLayers } from "../scripts/lib/captions.mjs";
import { findFont, findCjkFont } from "../scripts/lib/fonts.mjs";

test("captions wrap within the portrait safe area and never overlap", async (t) => {
  const assetsDir = await mkdtemp(path.join(os.tmpdir(), "demo-reel-captions-"));
  t.after(() => rm(assetsDir, { recursive: true, force: true }));
  const options = {
    assetsDir, font: findFont(), cjkFont: findCjkFont(), durationSec: 4,
    layout: { key: "vertical", width: 1080, caption: { y: 1420, size: 42, box: 20, width: 960, height: 220 } },
  };
  assert.ok(options.font, "caption verification needs a system font");
  const layers = await createCaptionLayers({ ...options, events: [
    { t: 0, caption: 'Keep every step readable, even when a release description needs more than one line.' },
    { t: 300, caption: '让演示中的每一步都清晰可读，较长的中文说明也应该自动换行并保持在画面之内。' },
    { t: 2500, caption: "Literal <b> & 'quotes': 50% [done];\nReady for release" },
  ] });
  assert.equal(layers.length, 3);
  assert.equal(layers[0].end, layers[1].start, "a rapid next caption must end the previous one");
  for (const layer of layers) {
    const { data, info } = await sharp(layer.file).raw().toBuffer({ resolveWithObject: true });
    assert.ok(info.width <= 960 && info.height <= 220, "caption must stay inside its reserved area");
    assert.ok(layer.x >= 60 && layer.y + info.height <= 1640, "caption must clear the frame edge and CTA");
    assert.equal(info.channels, 4);
    assert.ok(data[3] > 180 && data[3] < 200, "caption background must retain transparency");
    const rows = [];
    for (let y = 0; y < info.height; y++) {
      let hasInk = false;
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) { hasInk = true; break; }
      }
      rows.push(hasInk);
    }
    assert.ok(rows.filter((ink, i) => ink && !rows[i - 1]).length >= 2, "long text must occupy multiple lines");
  }
  await assert.rejects(createCaptionLayers({ ...options,
    events: [{ t: 0, caption: "Too much text for a readable caption. ".repeat(100) }],
  }), /too long.*shorten/);
});
