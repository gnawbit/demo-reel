import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseCommand } from "./lib/options.mjs";
import sharp from "sharp";
import { ffmpeg, probe } from "./lib/ffmpeg.mjs";
import { findCjkFont, findFont, hasCjk } from "./lib/fonts.mjs";
import { buildCameraFilter } from "./lib/camera.mjs";
import { createCaptionLayers } from "./lib/captions.mjs";
import { assertConfig, readConfig } from "./lib/config.mjs";
import { createReporter } from "./lib/report.mjs";
import { resolveTheme } from "./lib/themes.mjs";

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

function landscapeLayout(videoW, videoH) {
  const layout = LAYOUTS.landscape;
  // Reserve a separate caption band and retain the full source at overview.
  const fit = Math.min(layout.content.w / videoW, 760 / videoH);
  const w = Math.max(2, Math.floor(videoW * fit / 2) * 2);
  const h = Math.max(2, Math.floor(videoH * fit / 2) * 2);
  const x = (layout.width - w) / 2;
  const y = 122 + (760 - h) / 2;
  return {
    ...layout,
    content: { x, y, w, h },
    frame: { ...layout.frame, x: x - 16, y: y - 52, w: w + 32, h: h + 52 },
  };
}

function verticalLayout(videoW, videoH) {
  const layout = LAYOUTS.vertical;
  // Fit the source between branding and captions instead of cropping a phone
  // recording into the landscape card. Keep the existing 16:9 card geometry.
  const fit = Math.min(layout.content.w / videoW, 900 / videoH);
  const w = Math.max(2, Math.floor(videoW * fit / 2) * 2);
  const h = Math.max(2, Math.floor(videoH * fit / 2) * 2);
  const x = (layout.width - w) / 2;
  const y = layout.content.y + (layout.content.h - h) / 2;
  return {
    ...layout,
    content: { x, y, w, h },
    frame: { ...layout.frame, x: x - 16, y: y - 16, w: w + 32, h: h + 32 },
  };
}

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

async function makeBackground(file, theme, layout) {
  const base = theme.background || "#070A12";
  const accent = theme.accent || "#6C5CE7";
  const light = Boolean(theme.light);
  const dark = light ? mix(base, "#94A3B8", 0.14) : mix(base, "#000000", 0.35);
  const lighter = light ? mix(base, "#FFFFFF", 0.55) : mix(base, "#FFFFFF", 0.08);
  const gridColor = light ? "#000000" : "#ffffff";
  const gridOpacity = light ? "0.035" : "0.03";
  const glowOpacity = light ? "0.14" : "0.3";
  const glowMidOpacity = light ? "0.04" : "0.07";
  const glow2Opacity = light ? "0.08" : "0.14";
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
      <stop offset="0" stop-color="${accent}" stop-opacity="${glowOpacity}"/>
      <stop offset="0.55" stop-color="${accent}" stop-opacity="${glowMidOpacity}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="50%" cy="100%" r="60%">
      <stop offset="0" stop-color="${accent}" stop-opacity="${glow2Opacity}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse">
      <path d="M${grid} 0H0V${grid}" fill="none" stroke="${gridColor}" stroke-opacity="${gridOpacity}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect width="100%" height="100%" fill="url(#glow2)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function makeBrowserFrame(file, hostname, layout, theme) {
  const url = escapeXml(hostname || "your-app.com");
  const { x, y, w, h } = layout.frame;
  const bar = layout.content.y - y;
  const f = theme.frame;
  const addressWidth = Math.max(0, Math.min(560, w - 128));
  const address = addressWidth >= 120 ? `
  <clipPath id="address-clip"><rect x="${x + 114}" y="${y + 13}" width="${addressWidth - 20}" height="26"/></clipPath>
  <rect x="${x + 104}" y="${y + 13}" width="${addressWidth}" height="26" rx="13" fill="${f.addressBg}" stroke="${f.addressBorder}"/>
  <text clip-path="url(#address-clip)" x="${x + 122}" y="${y + 30}" font-family="Arial, Segoe UI, sans-serif" font-size="12.5" fill="${f.addressText}">${url}</text>` : "";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000000" flood-opacity="${f.shadowAlpha}"/>
    </filter>
    <mask id="content-cutout">
      <rect width="${layout.width}" height="${layout.height}" fill="white"/>
      <rect x="${layout.content.x}" y="${layout.content.y}" width="${layout.content.w}" height="${layout.content.h}" fill="black"/>
    </mask>
  </defs>
  <g mask="url(#content-cutout)">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${f.bar}" filter="url(#shadow)" opacity="${theme.light ? 0.85 : 0.25}"/>
  <path d="M${x} ${y + 18}a18 18 0 0 1 18-18h${w - 36}a18 18 0 0 1 18 18v${bar - 18}H${x}z" fill="${f.bar}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="none" stroke="${f.border}" stroke-width="1.5"/>
  <path d="M${x} ${y + bar}H${x + w}" stroke="${f.divider}" stroke-width="1"/>
  <circle cx="${x + 32}" cy="${y + bar / 2}" r="5.5" fill="#FF5F57"/>
  <circle cx="${x + 54}" cy="${y + bar / 2}" r="5.5" fill="#FEBC2E"/>
  <circle cx="${x + 76}" cy="${y + bar / 2}" r="5.5" fill="#28C840"/>
  ${address}
  <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="17" fill="none" stroke="#ffffff" stroke-opacity="${f.edgeOpacity}"/>
  </g>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function makeCardFrame(file, layout, theme) {
  const { x, y, w, h } = layout.frame;
  const f = theme.frame;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="26" stdDeviation="34" flood-color="#000000" flood-opacity="${f.shadowAlpha}"/>
    </filter>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="${theme.light ? 0.8 : 0.16}"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
    <mask id="content-cutout">
      <rect width="${layout.width}" height="${layout.height}" fill="white"/>
      <rect x="${layout.content.x}" y="${layout.content.y}" width="${layout.content.w}" height="${layout.content.h}" fill="black"/>
    </mask>
  </defs>
  <g mask="url(#content-cutout)">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${f.bar}" filter="url(#shadow)" opacity="${theme.light ? 0.75 : 0.3}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="${f.border}" stroke-width="1.5"/>
  <rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="20.5" fill="none" stroke="url(#edge)" stroke-width="1"/>
  <path d="M${x + 24} ${y + 1.5}H${x + w - 24}" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>
  </g>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

function buildVerticalChrome(font, cjkFont, hostname, layout, vertical = {}, theme) {
  if (!font || !layout.title) return "";

  const pickFont = (text) => (hasCjk(text) ? cjkFont || font : font);
  const accentHex = String(theme.accent || "#6C5CE7").replace("#", "0x");
  const c = theme.chrome;
  const filters = [];

  const badge = vertical.badge || "PRODUCT DEMO";
  const badgeFont = pickFont(badge);
  filters.push(
    `drawtext=fontfile='${fontPathForFilter(badgeFont)}':text='${escapeDrawtext(badge)}':` +
      `fontsize=20:fontcolor=${c.text}:box=1:boxcolor=${accentHex}@${c.badgeBoxAlpha}:boxborderw=12:` +
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
        `fontsize=${titleSize}:fontcolor=${c.text}:x=(w-text_w)/2:` +
        `y=${startY + index * (titleSize + 18)}`,
    );
  });

  if (vertical.subtitle) {
    const subtitleFont = pickFont(vertical.subtitle);
    const subtitleY =
      startY + titleLines.length * (titleSize + 18) + Number(vertical.subtitleGap ?? 8);
    filters.push(
      `drawtext=fontfile='${fontPathForFilter(subtitleFont)}':text='${escapeDrawtext(vertical.subtitle)}':` +
        `fontsize=${Number(vertical.subtitleSize || 26)}:fontcolor=${c.muted}:` +
        `x=(w-text_w)/2:y=${subtitleY}`,
    );
  }

  if (vertical.cta) {
    const ctaFont = pickFont(vertical.cta);
    filters.push(
      `drawtext=fontfile='${fontPathForFilter(ctaFont)}':text='${escapeDrawtext(vertical.cta)}':` +
        `fontsize=${Number(vertical.ctaSize || 28)}:fontcolor=${c.ctaText}:` +
        `box=1:boxcolor=${accentHex}@0.92:boxborderw=18:` +
        `x=(w-text_w)/2:y=${Number(vertical.ctaY ?? 1740)}`,
    );
  }

  if (vertical.watermark !== false && layout.watermark) {
    filters.push(
      `drawtext=fontfile='${fontPathForFilter(font)}':text='TabRetake':` +
        `fontsize=${layout.watermark.size}:fontcolor=${c.watermark}:` +
        `x=(w-text_w)/2:y=${layout.watermark.y}`,
    );
  }

  return filters.join(",");
}

async function renderLayout({
  layout,
  record,
  theme,
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
  log,
}) {
  const artifacts = [];
  const assetsDir = path.join(outDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  const bgPath = path.join(assetsDir, `background-${layout.key}.png`);
  const framePath = path.join(assetsDir, `frame-${layout.key}.png`);

  await makeBackground(bgPath, theme, layout);
  if (layout.frame.type === "browser") {
    await makeBrowserFrame(framePath, hostname, layout, theme);
  } else {
    await makeCardFrame(framePath, layout, theme);
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
    events: record.events || [], durationSec, font, cjkFont, layout, assetsDir, theme,
  });
  const chromeFilter = buildVerticalChrome(
    font,
    cjkFont,
    hostname,
    layout,
    record.config?.vertical || {},
    theme,
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

  log(`Video: ${outputPath}`);
  artifacts.push({ kind: "video", path: outputPath, layout: layout.key, width: layout.width, height: layout.height });

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
    log(`GIF:   ${gifPath}`);
    artifacts.push({ kind: "gif", path: gifPath, layout: layout.key });
  }

  const posterPath = path.join(outDir, layout.poster);
  await ffmpeg([
    "-ss", posterAt.toFixed(6),
    "-i", outputPath,
    "-frames:v", "1",
    "-q:v", "2",
    posterPath,
  ]);
  log(`Poster: ${posterPath} (${posterAt.toFixed(2)}s)`);
  artifacts.push({ kind: "poster", path: posterPath, layout: layout.key });

  return { outputPath, moves: camera.moves, artifacts };
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
  const { values } = parseCommand("render", argv);
  const reporter = createReporter("render", values.json);

  if (!values.config) throw new Error("Missing --config");

  const configPath = path.resolve(values.config);
  const raw = assertConfig(await readConfig(configPath));
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
      record = assertConfig(await readConfig(recordPath), { kind: "record" });
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
  const verticalZoom = values["vertical-zoom"] === undefined
    ? (record.config?.vertical?.zoom ?? zoom)
    : Number(values["vertical-zoom"]);
  if (!Number.isFinite(verticalZoom) || verticalZoom < 1 || verticalZoom > 10) {
    throw new Error("vertical.zoom / --vertical-zoom must be a number between 1 and 10");
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

  const theme = resolveTheme(record.config?.brand, values.preset);

  const layouts = [landscapeLayout(videoW, videoH)];
  if (values.vertical) layouts.push(verticalLayout(videoW, videoH));

  let last = null;
  const artifacts = [];
  for (const layout of layouts) {
    last = await renderLayout({
      layout,
      record,
      theme,
      videoPath,
      outDir,
      videoW,
      videoH,
      durationSec,
      videoOffset,
      zoom: layout.key === "vertical" ? verticalZoom : zoom,
      zoomDuration,
      font,
      cjkFont,
      hostname,
      noGif: values["no-gif"],
      posterAt,
      log: reporter.log,
    });
    artifacts.push(...last.artifacts);
  }

  reporter.log(
    `\nDone. ${last?.moves.length || 0} camera move(s), ${durationSec.toFixed(1)}s` +
      (values.vertical ? ", 16:9 + 9:16" : "") +
      ".\n",
  );
  await reporter.success({ duration: durationSec, posterAt, artifacts });
  return last?.outputPath;
}
