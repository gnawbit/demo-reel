import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { ffmpeg, probe } from "./lib/ffmpeg.mjs";
import { findFont } from "./lib/fonts.mjs";

const OUT_W = 1920;
const OUT_H = 1080;
const CONTENT_X = 160;
const CONTENT_Y = 122;
const CONTENT_W = 1600;
const CONTENT_H = 900;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

function hexToRgb(hex) {
  const clean = String(hex || "#070A12").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const c = (k) => Math.round(a[k] + (b[k] - a[k]) * amount);
  return `#${[c("r"), c("g"), c("b")].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeDrawtext(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\n/g, "\\n");
}

async function makeBackground(file, brand = {}) {
  const base = brand.background || "#070A12";
  const accent = brand.accent || "#6C5CE7";
  const dark = mix(base, "#000000", 0.35);
  const lighter = mix(base, "#FFFFFF", 0.08);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${lighter}"/>
      <stop offset="0.55" stop-color="${base}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="75%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.28"/>
      <stop offset="0.55" stop-color="${accent}" stop-opacity="0.06"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0V44" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function makeFrame(file, hostname) {
  const url = escapeXml(hostname || "your-app.com");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect x="144" y="70" width="1632" height="952" rx="18" fill="#0D1117" filter="url(#shadow)" opacity="0.25"/>
  <path d="M144 88a18 18 0 0 1 18-18h1596a18 18 0 0 1 18 18v34H144z" fill="#0D1117"/>
  <rect x="144" y="70" width="1632" height="952" rx="18" fill="none" stroke="#2A3140" stroke-width="1.5"/>
  <path d="M144 122H1776" stroke="#202634" stroke-width="1"/>
  <circle cx="176" cy="96" r="5.5" fill="#FF5F57"/>
  <circle cx="198" cy="96" r="5.5" fill="#FEBC2E"/>
  <circle cx="220" cy="96" r="5.5" fill="#28C840"/>
  <rect x="248" y="83" width="560" height="26" rx="13" fill="#161B23" stroke="#262D3A"/>
  <text x="266" y="100" font-family="Arial, Segoe UI, sans-serif" font-size="12.5" fill="#8A93A6">${url}</text>
  <rect x="145" y="71" width="1630" height="950" rx="17" fill="none" stroke="#ffffff" stroke-opacity="0.04"/>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

function buildSegments(events, durationSec) {
  const pts = events
    .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.x) && Number.isFinite(e.y))
    .map((e) => ({ ...e, sec: e.t / 1000 }))
    .filter((e) => e.sec > 0.05 && e.sec < durationSec - 0.05)
    .sort((a, b) => a.sec - b.sec);

  if (pts.length === 0) return [{ start: 0, end: durationSec, focus: null }];

  const segments = [];
  let start = 0;

  for (let i = 0; i < pts.length; i += 1) {
    const end = pts[i].sec;
    if (end - start > 0.25) {
      const previous = i > 0 ? pts[i - 1] : null;
      segments.push({
        start,
        end,
        focus: previous && previous.zoom !== false ? previous : null,
      });
      start = end;
    }
  }

  if (durationSec - start > 0.25) {
    const last = pts[pts.length - 1];
    segments.push({
      start,
      end: durationSec,
      focus: last && last.zoom !== false ? last : null,
    });
  }

  return segments.length ? segments : [{ start: 0, end: durationSec, focus: null }];
}

function buildVideoFilter({ segments, videoW, videoH, scale, zoom, videoOffset = 0 }) {
  const N = segments.length;
  const split = N > 1 ? `[1:v]split=${N}${segments.map((_, i) => `[v${i}]`).join("")};` : "";
  const segmentFilters = [];

  segments.forEach((seg, i) => {
    const input = N > 1 ? `[v${i}]` : "[1:v]";
    const trimStart = videoOffset + seg.start;
    const trimEnd = videoOffset + seg.end;
    const trim = `trim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)},setpts=PTS-STARTPTS`;
    let crop = "";

    if (seg.focus) {
      const cw = Math.max(2, Math.round(videoW / zoom / 2) * 2);
      const ch = Math.max(2, Math.round(videoH / zoom / 2) * 2);
      const fx = seg.focus.x * scale;
      const fy = seg.focus.y * scale;
      const cx = Math.round(clamp(fx - cw / 2, 0, videoW - cw) / 2) * 2;
      const cy = Math.round(clamp(fy - ch / 2, 0, videoH - ch) / 2) * 2;
      crop = `,crop=${cw}:${ch}:${cx}:${cy},scale=${CONTENT_W}:${CONTENT_H}:flags=lanczos,setsar=1`;
    } else {
      crop = `,scale=${CONTENT_W}:${CONTENT_H}:force_original_aspect_ratio=increase,crop=${CONTENT_W}:${CONTENT_H},setsar=1`;
    }

    segmentFilters.push(`${input}${trim}${crop}[s${i}]`);
  });

  const concat =
    N > 1
      ? `${segments.map((_, i) => `[s${i}]`).join("")}concat=n=${N}:v=1:a=0[base]`
      : "[s0]null[base]";

  return `${split}${segmentFilters.join(";")};${concat}`;
}

function buildCaptionFilters(events, durationSec, font) {
  if (!font) return "";

  const withCaptions = events
    .filter((e) => e.caption && Number.isFinite(e.tEnd ?? e.t))
    .sort((a, b) => a.t - b.t);

  if (withCaptions.length === 0) return "";

  const filters = [];

  for (let i = 0; i < withCaptions.length; i += 1) {
    const start = (withCaptions[i].tEnd ?? withCaptions[i].t) / 1000;
    const next = withCaptions[i + 1] ? withCaptions[i + 1].t / 1000 : null;
    let end = Math.min(next || start + 2.8, start + 2.8, durationSec);
    if (end - start < 0.7) end = Math.min(start + 1.4, durationSec);
    if (end <= start) continue;

    const fontPath = font.replace(/\\/g, "/").replace(/:/g, "\\:");
    const text = escapeDrawtext(withCaptions[i].caption);

    filters.push(
      `drawtext=fontfile='${fontPath}':text='${text}':fontcolor=white:fontsize=36:` +
        `box=1:boxcolor=0x0B0F19@0.74:boxborderw=16:` +
        `x=(w-text_w)/2:y=930:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`,
    );
  }

  return filters.join(",");
}

export async function render(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: "string" },
      out: { type: "string" },
      "no-gif": { type: "boolean", default: false },
      "no-captions": { type: "boolean", default: false },
      zoom: { type: "string", default: "1.28" },
    },
  });

  if (!values.config) throw new Error("Missing --config");

  const configPath = path.resolve(values.config);
  const raw = JSON.parse(await readFile(configPath, "utf8"));

  let record = raw;
  let outDir = values.out ? path.resolve(values.out) : path.dirname(configPath);
  let recordDir = path.dirname(configPath);

  if (!raw.video) {
    outDir = values.out ? path.resolve(values.out) : path.resolve("demo");
    const recordPath = path.join(outDir, "record.json");
    record = JSON.parse(await readFile(recordPath, "utf8"));
    recordDir = outDir;
  }

  const videoPath = path.isAbsolute(record.video)
    ? record.video
    : path.resolve(recordDir, record.video);

  const assetsDir = path.join(outDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  const brand = record.config?.brand || {};
  const bgPath = path.join(assetsDir, "background.png");
  const framePath = path.join(assetsDir, "frame.png");
  const hostname =
    record.config?.displayUrl ||
    (() => {
      try {
        return new URL(record.url).hostname;
      } catch {
        return "your-app.com";
      }
    })();

  await makeBackground(bgPath, brand);
  await makeFrame(framePath, hostname);

  const info = await probe(videoPath);
  const videoStream = (info.streams || []).find((s) => s.codec_type === "video");
  const videoW = Number(videoStream?.width || 0);
  const videoH = Number(videoStream?.height || 0);
  const videoDurationSec = Number(info.format?.duration || 0);

  if (!videoW || !videoH || !videoDurationSec) {
    throw new Error(`Could not read video metadata: ${videoPath}`);
  }

  const videoOffset = Math.max(0, Number(record.videoOffset || 0));
  const timelineDuration = Number(record.duration || videoDurationSec - videoOffset);
  const durationSec = Math.max(
    0.5,
    Math.min(timelineDuration, videoDurationSec - videoOffset),
  );

  const zoom = Math.max(1, Number(values.zoom || 1.28));
  const segments = buildSegments(record.events || [], durationSec);
  const videoFilter = buildVideoFilter({
    segments,
    videoW,
    videoH,
    scale: Number(record.scale || 1),
    zoom,
    videoOffset,
  });

  const font = values["no-captions"] ? null : findFont();
  if (!values["no-captions"] && !font) {
    console.warn("No system font found; captions will be skipped.");
  }
  const captionFilter = buildCaptionFilters(record.events || [], durationSec, font);

  const outputPath = path.join(outDir, "demo-16x9.mp4");

  const graph = [
    `[0:v]scale=${OUT_W}:${OUT_H}[bg]`,
    videoFilter,
    `[bg][base]overlay=${CONTENT_X}:${CONTENT_Y}:format=auto[comp]`,
    `[comp][2:v]overlay=0:0[out]`,
  ];

  if (captionFilter) graph.push(`[out]${captionFilter}[v]`);
  else graph.push(`[out]null[v]`);

  await ffmpeg([
    "-loop", "1", "-i", bgPath,
    "-i", videoPath,
    "-loop", "1", "-i", framePath,
    "-filter_complex", graph.join(";"),
    "-map", "[v]",
    "-an",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-t", durationSec.toFixed(3),
    outputPath,
  ]);

  console.log(`Video: ${outputPath}`);

  if (!values["no-gif"]) {
    const gifPath = path.join(outDir, "demo.gif");
    await ffmpeg([
      "-i", outputPath,
      "-vf",
      "fps=15,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop", "0",
      gifPath,
    ]);
    console.log(`GIF:   ${gifPath}`);
  }

  const posterPath = path.join(outDir, "poster.png");
  await ffmpeg([
    "-ss", "1.2",
    "-i", outputPath,
    "-frames:v", "1",
    "-q:v", "2",
    posterPath,
  ]);
  console.log(`Poster: ${posterPath}`);

  console.log(`\nDone. ${segments.length} segment(s), ${durationSec.toFixed(1)}s.\n`);
  return outputPath;
}
