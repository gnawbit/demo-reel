import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { ffmpeg, probe } from "./lib/ffmpeg.mjs";
import { findCjkFont, findFont, hasCjk } from "./lib/fonts.mjs";
import { buildCameraFilter } from "./lib/camera.mjs";
import { createCaptionLayers } from "./lib/captions.mjs";

const LAYOUTS = {
  landscape: {
    key: "landscape",
    width: 1920,
    height: 1080,
    content: { x: 160, y: 122, w: 1600, h: 900 },
    frame: { type: "browser", x: 144, y: 70, w: 1632, h: 952 },
    caption: { y: 910, size: 36, box: 16, width: 1520, height: 130 },
    title: null,
    watermark: null,
    video: "demo-16x9.mp4",
    gif: "demo.gif",
    poster: "poster.png",
    gifWidth: 960,
    gifFps: 15,
  },
  vertical: {
    key: "vertical",
    width: 1080,
    height: 1920,
    content: { x: 40, y: 620, w: 1000, h: 562 },
    frame: { type: "card", x: 24, y: 604, w: 1032, h: 594 },
    caption: { y: 1420, size: 42, box: 20, width: 960, height: 220 },
    title: { pillY: 180, domainY: 230, size: 30 },
    watermark: { y: 1800, size: 18 },
    video: "demo-9x16.mp4",
    gif: "demo-9x16.gif",
    poster: "poster-9x16.png",
    gifWidth: 540,
    gifFps: 12,
  },
};

function hexToRgb(hex) {
  const clean = String(hex || "#070A12").replace("#", "");
  const full =
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const c = (k) => Math.round(a[k] + (b[k] - a[k]) * amount);
  return `#${[c("r"), c("g"), c("b")]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
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

function fontPathForFilter(font) {
  return font.replace(/\\/g, "/").replace(/:/g, "\\:");
}

async function makeBackground(file, brand = {}, layout) {
  const base = brand.background || "#070A12";
  const accent = brand.accent || "#6C5CE7";
  const dark = mix(base, "#000000", 0.35);
  const lighter = mix(base, "#FFFFFF", 0.08);
  const grid = layout.key === "vertical" ? 40 : 44;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${lighter}"/>
      <stop offset="0.55" stop-color="${base}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="75%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.3"/>
      <stop offset="0.55" stop-color="${accent}" stop-opacity="0.07"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="50%" cy="100%" r="60%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.14"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse">
      <path d="M${grid} 0H0V${grid}" fill="none" stroke="#ffffff" stroke-opacity="0.03" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect width="100%" height="100%" fill="url(#glow2)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function makeBrowserFrame(file, hostname, layout) {
  const url = escapeXml(hostname || "your-app.com");
  const { x, y, w, h } = layout.frame;
  const bar = layout.content.y - y;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    <mask id="content-cutout">
      <rect width="${layout.width}" height="${layout.height}" fill="white"/>
      <rect x="${layout.content.x}" y="${layout.content.y}" width="${layout.content.w}" height="${layout.content.h}" fill="black"/>
    </mask>
  </defs>
  <g mask="url(#content-cutout)">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#0D1117" filter="url(#shadow)" opacity="0.25"/>
  <path d="M${x} ${y + 18}a18 18 0 0 1 18-18h${w - 36}a18 18 0 0 1 18 18v${bar - 18}H${x}z" fill="#0D1117"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="none" stroke="#2A3140" stroke-width="1.5"/>
  <path d="M${x} ${y + bar}H${x + w}" stroke="#202634" stroke-width="1"/>
  <circle cx="${x + 32}" cy="${y + bar / 2}" r="5.5" fill="#FF5F57"/>
  <circle cx="${x + 54}" cy="${y + bar / 2}" r="5.5" fill="#FEBC2E"/>
  <circle cx="${x + 76}" cy="${y + bar / 2}" r="5.5" fill="#28C840"/>
  <rect x="${x + 104}" y="${y + 13}" width="560" height="26" rx="13" fill="#161B23" stroke="#262D3A"/>
  <text x="${x + 122}" y="${y + 30}" font-family="Arial, Segoe UI, sans-serif" font-size="12.5" fill="#8A93A6">${url}</text>
  <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="17" fill="none" stroke="#ffffff" stroke-opacity="0.04"/>
  </g>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function makeCardFrame(file, layout) {
  const { x, y, w, h } = layout.frame;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="26" stdDeviation="34" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
    <mask id="content-cutout">
      <rect width="${layout.width}" height="${layout.height}" fill="white"/>
      <rect x="${layout.content.x}" y="${layout.content.y}" width="${layout.content.w}" height="${layout.content.h}" fill="black"/>
    </mask>
  </defs>
  <g mask="url(#content-cutout)">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#0D1117" filter="url(#shadow)" opacity="0.3"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="#2A3140" stroke-width="1.5"/>
  <rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="20.5" fill="none" stroke="url(#edge)" stroke-width="1"/>
  <path d="M${x + 24} ${y + 1.5}H${x + w - 24}" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>
  </g>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

function buildVerticalChrome(font, cjkFont, hostname, layout, vertical = {}, accent) {
  if (!font || !layout.title) return "";

  const pickFont = (text) => (hasCjk(text) ? cjkFont || font : font);
  const accentHex = String(accent || "#6C5CE7").replace("#", "0x");
  const filters = [];

  const badge = vertical.badge || "PRODUCT DEMO";
  const badgeFont = pickFont(badge);
  filters.push(
    `drawtext=fontfile='${fontPathForFilter(badgeFont)}':text='${escapeDrawtext(badge)}':` +
      `fontsize=20:fontcolor=0xE9EDF5:box=1:boxcolor=${accentHex}@0.22:boxborderw=12:` +
      `x=(w-text_w)/2:y=${layout.title.pillY}`,
  );

  const titleLines =
    Array.isArray(vertical.titleLines) && vertical.titleLines.length
      ? vertical.titleLines.slice(0, 2)
      : [hostname || "your-app.com"];
  const titleSize = Number(
    vertical.titleSize || (Array.isArray(vertical.titleLines) ? 52 : 30),
  );
  const startY = Number(
    vertical.titleY ?? layout.title.pillY + (Array.isArray(vertical.titleLines) ? 70 : 50),
  );

  titleLines.forEach((line, index) => {
    const lineFont = pickFont(line);
    filters.push(
      `drawtext=fontfile='${fontPathForFilter(lineFont)}':text='${escapeDrawtext(line)}':` +
        `fontsize=${titleSize}:fontcolor=0xE9EDF5:x=(w-text_w)/2:` +
        `y=${startY + index * (titleSize + 18)}`,
    );
  });

  if (vertical.subtitle) {
    const subtitleFont = pickFont(vertical.subtitle);
    const subtitleY =
      startY + titleLines.length * (titleSize + 18) + Number(vertical.subtitleGap ?? 8);
    filters.push(
      `drawtext=fontfile='${fontPathForFilter(subtitleFont)}':text='${escapeDrawtext(vertical.subtitle)}':` +
        `fontsize=${Number(vertical.subtitleSize || 26)}:fontcolor=0x8A93A6:` +
        `x=(w-text_w)/2:y=${subtitleY}`,
    );
  }

  if (vertical.cta) {
    const ctaFont = pickFont(vertical.cta);
    filters.push(
      `drawtext=fontfile='${fontPathForFilter(ctaFont)}':text='${escapeDrawtext(vertical.cta)}':` +
        `fontsize=${Number(vertical.ctaSize || 28)}:fontcolor=0xFFFFFF:` +
        `box=1:boxcolor=${accentHex}@0.92:boxborderw=18:` +
        `x=(w-text_w)/2:y=${Number(vertical.ctaY ?? 1740)}`,
    );
  }

  if (vertical.watermark !== false && layout.watermark) {
    filters.push(
      `drawtext=fontfile='${fontPathForFilter(font)}':text='demo-reel':` +
        `fontsize=${layout.watermark.size}:fontcolor=0x5D6678:` +
        `x=(w-text_w)/2:y=${layout.watermark.y}`,
    );
  }

  return filters.join(",");
}

async function renderLayout({
  layout,
  record,
  videoPath,
  outDir,
  videoW,
  videoH,
  durationSec,
  videoOffset,
  zoom,
  zoomDuration,
  font,
  cjkFont,
  hostname,
  noGif,
  posterAt,
}) {
  const assetsDir = path.join(outDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  const bgPath = path.join(assetsDir, `background-${layout.key}.png`);
  const framePath = path.join(assetsDir, `frame-${layout.key}.png`);

  await makeBackground(bgPath, record.config?.brand || {}, layout);
  if (layout.frame.type === "browser") {
    await makeBrowserFrame(framePath, hostname, layout);
  } else {
    await makeCardFrame(framePath, layout);
  }

  const camera = buildCameraFilter({
    events: record.events || [],
    durationSec,
    videoW,
    videoH,
    scale: Number(record.scale || 1),
    zoom,
    transition: zoomDuration,
    videoOffset,
    contentW: layout.content.w,
    contentH: layout.content.h,
  });

  const captions = await createCaptionLayers({
    events: record.events || [], durationSec, font, cjkFont, layout, assetsDir,
  });
  const chromeFilter = buildVerticalChrome(
    font,
    cjkFont,
    hostname,
    layout,
    record.config?.vertical || {},
    record.config?.brand?.accent,
  );
  const graph = [
    `[0:v]scale=${layout.width}:${layout.height}[bg]`,
    `[1:v]${camera.filter}[base]`,
    `[bg][base]overlay=${layout.content.x}:${layout.content.y}:format=auto[comp]`,
    `[comp][2:v]overlay=0:0[out]`,
  ];
  let lastLayer = "out";
  captions.forEach((caption, i) => {
    graph.push(`[${lastLayer}][${i + 3}:v]overlay=${caption.x}:${caption.y}:` +
      `enable='gte(t,${caption.start})*lt(t,${caption.end})'[caption${i}]`);
    lastLayer = `caption${i}`;
  });
  graph.push(chromeFilter ? `[${lastLayer}]${chromeFilter}[v]` : `[${lastLayer}]null[v]`);

  const outputPath = path.join(outDir, layout.video);
  await ffmpeg([
    "-loop", "1", "-framerate", "30", "-i", bgPath,
    "-i", videoPath,
    "-i", framePath,
    ...captions.flatMap((caption) => ["-i", caption.file]),
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

  if (!noGif) {
    const gifPath = path.join(outDir, layout.gif);
    await ffmpeg([
      "-i", outputPath,
      "-vf",
      `fps=${layout.gifFps},scale=${layout.gifWidth}:-1:flags=lanczos,split[s0][s1];` +
        "[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop", "0",
      gifPath,
    ]);
    console.log(`GIF:   ${gifPath}`);
  }

  const posterPath = path.join(outDir, layout.poster);
  await ffmpeg([
    "-ss", posterAt.toFixed(6),
    "-i", outputPath,
    "-frames:v", "1",
    "-q:v", "2",
    posterPath,
  ]);
  console.log(`Poster: ${posterPath} (${posterAt.toFixed(2)}s)`);

  return { outputPath, moves: camera.moves };
}

function marksToEvents(marks, videoW, videoH) {
  return marks
    .map((mark) => {
      const t = Number(mark.t || 0) * 1000;
      const hold = Number(mark.duration ?? 0.6);
      const x = Number(mark.x ?? 0.5);
      const y = Number(mark.y ?? 0.5);

      return {
        t,
        tEnd: t + hold * 1000,
        action: "mark",
        x: x <= 1 ? x * videoW : x,
        y: y <= 1 ? y * videoH : y,
        caption: mark.caption || "",
        zoom: mark.zoom !== false,
        label: mark.label || "",
      };
    })
    .sort((a, b) => a.t - b.t);
}

export async function render(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: "string" },
      video: { type: "string" },
      out: { type: "string" },
      "no-gif": { type: "boolean", default: false },
      "no-captions": { type: "boolean", default: false },
      vertical: { type: "boolean", default: false },
      zoom: { type: "string", default: "1.28" },
      "zoom-duration": { type: "string" },
      "poster-at": { type: "string" },
    },
  });

  if (!values.config) throw new Error("Missing --config");

  const configPath = path.resolve(values.config);
  const raw = JSON.parse(await readFile(configPath, "utf8"));
  const videoOverride = values.video ? path.resolve(values.video) : null;
  const isMarkConfig = Array.isArray(raw.marks) && (videoOverride || raw.video);

  let record;
  let outDir;
  let videoPath;
  let probed = null;

  if (isMarkConfig) {
    videoPath = videoOverride || path.resolve(path.dirname(configPath), raw.video);
    outDir = values.out ? path.resolve(values.out) : path.resolve(raw.out || "demo");
    probed = await probe(videoPath);

    const stream = (probed.streams || []).find((s) => s.codec_type === "video");
    const videoW = Number(stream?.width || 0);
    const videoH = Number(stream?.height || 0);
    const videoDurationSec = Number(probed.format?.duration || 0);

    if (!videoW || !videoH || !videoDurationSec) {
      throw new Error(`Could not read video metadata: ${videoPath}`);
    }

    record = {
      config: raw,
      url: raw.url || raw.displayUrl || "screen-recording",
      viewport: raw.viewport || { width: videoW, height: videoH },
      scale: 1,
      video: videoPath,
      videoOffset: 0,
      duration: Number(raw.duration || videoDurationSec),
      events: marksToEvents(raw.marks, videoW, videoH),
    };
  } else {
    record = raw;
    outDir = values.out ? path.resolve(values.out) : path.dirname(configPath);
    let recordDir = path.dirname(configPath);

    if (!raw.video) {
      outDir = values.out ? path.resolve(values.out) : path.resolve("demo");
      const recordPath = path.join(outDir, "record.json");
      record = JSON.parse(await readFile(recordPath, "utf8"));
      recordDir = outDir;
    }

    videoPath = path.isAbsolute(record.video)
      ? record.video
      : path.resolve(recordDir, record.video);
  }

  const hostname =
    record.config?.displayUrl ||
    (() => {
      try {
        return new URL(record.url).hostname;
      } catch {
        return "your-app.com";
      }
    })();

  const info = probed || (await probe(videoPath));
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

  const requestedPoster = values["poster-at"] === undefined
    ? record.config?.posterAt
    : (values["poster-at"].trim() === "" ? NaN : Number(values["poster-at"]));
  if (requestedPoster !== undefined && (
    typeof requestedPoster !== "number" || !Number.isFinite(requestedPoster) ||
    requestedPoster < 0 || requestedPoster >= durationSec
  )) {
    throw new Error(`posterAt / --poster-at must be a number from 0 up to (but not including) ${durationSec.toFixed(3)} seconds`);
  }
  // Select an existing 30 fps output frame, including for very short clips.
  const posterAt = Math.floor((requestedPoster ?? (
    durationSec - Math.min(0.5, durationSec / 10)
  )) * 30) / 30;

  const zoom = Number(values.zoom);
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > 10) {
    throw new Error("--zoom must be a number between 1 and 10");
  }
  const zoomDuration = values["zoom-duration"] === undefined
    ? (record.config?.zoomDuration ?? 0.35)
    : (values["zoom-duration"].trim() === "" ? NaN : Number(values["zoom-duration"]));
  if (typeof zoomDuration !== "number" || !Number.isFinite(zoomDuration) || zoomDuration < 0) {
    throw new Error("zoomDuration / --zoom-duration must be a non-negative number of seconds");
  }
  const font = values["no-captions"] ? null : findFont();
  const cjkFont = values["no-captions"] ? null : findCjkFont();
  if (!values["no-captions"] && !font) {
    console.warn("No system font found; captions will be skipped.");
  }
  if (!values["no-captions"] && !cjkFont) {
    console.warn("No CJK font found; Chinese captions may render as boxes.");
  }

  const layouts = [LAYOUTS.landscape];
  if (values.vertical) layouts.push(LAYOUTS.vertical);

  let last = null;
  for (const layout of layouts) {
    last = await renderLayout({
      layout,
      record,
      videoPath,
      outDir,
      videoW,
      videoH,
      durationSec,
      videoOffset,
      zoom,
      zoomDuration,
      font,
      cjkFont,
      hostname,
      noGif: values["no-gif"],
      posterAt,
    });
  }

  console.log(
    `\nDone. ${last?.moves.length || 0} camera move(s), ${durationSec.toFixed(1)}s` +
      (values.vertical ? ", 16:9 + 9:16" : "") +
      ".\n",
  );
  return last?.outputPath;
}
