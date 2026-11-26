import path from "node:path";
import sharp from "sharp";
import { hasCjk } from "./fonts.mjs";

const escapeMarkup = (text) => String(text).replace(/&/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function createCaptionLayers({
  events, durationSec, font, cjkFont, layout, assetsDir,
  theme = { caption: { fg: "white", bg: { r: 11, g: 15, b: 25, alpha: 0.74 } } },
}) {
  if (!font) return [];
  const fg = theme?.caption?.fg || "white";
  const bg = theme?.caption?.bg || { r: 11, g: 15, b: 25, alpha: 0.74 };
  const captions = events.map((event) => ({ text: String(event.caption || ""), start: (event.tEnd ?? event.t) / 1000 }))
    .filter(({ text, start }) => text.trim() && Number.isFinite(start) && start >= 0 && start < durationSec)
    .sort((a, b) => a.start - b.start);
  const { y, size, box, width, height } = layout.caption;
  const layers = [];
  for (let i = 0; i < captions.length; i++) {
    const { text, start } = captions[i];
    const end = Math.min(captions[i + 1]?.start ?? durationSec, start + 2.8, durationSec);
    if (end <= start) continue;
    const options = {
      text: `<span foreground="${fg}">${escapeMarkup(text)}</span>`,
      font: `sans-serif ${size}`, fontfile: hasCjk(text) ? cjkFont || font : font,
      width: width - box * 2, align: "centre", rgba: true, wrap: "word-char",
    };
    let rendered = await sharp({ text: { ...options, dpi: 72 } }).png().toBuffer({ resolveWithObject: true });
    if (rendered.info.height > height - box * 2) {
      rendered = await sharp({ text: { ...options, height: height - box * 2 } }).png().toBuffer({ resolveWithObject: true });
      if (rendered.info.textAutofitDpi < 48) {
        throw new Error(`Caption at ${start.toFixed(2)}s is too long for ${layout.key}; shorten it or split it across steps`);
      }
    }
    const file = path.join(assetsDir, `caption-${layout.key}-${i}.png`);
    const info = await sharp({ create: {
      width: rendered.info.width + box * 2, height: rendered.info.height + box * 2,
      channels: 4, background: bg,
    } }).composite([{ input: rendered.data, top: box, left: box }]).png().toFile(file);
    layers.push({ file, start, end, x: Math.floor((layout.width - info.width) / 2), y });
  }
  return layers;
}
