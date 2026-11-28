import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { parseCommand } from "./lib/options.mjs";
import { assertConfig, inspectConfig } from "./lib/config.mjs";
import { probeVideoMeta } from "./lib/ffmpeg.mjs";
import { commandError, createReporter } from "./lib/report.mjs";
import { resolveTheme } from "./lib/themes.mjs";
import { executeRender } from "./render.mjs";

const VIDEO_MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
};

function openSystemBrowser(url) {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // Ignore errors when a desktop browser launcher is unavailable.
  }
}

async function readJsonBody(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function renderMarkHtml({ token, duration, width, height, preset, videoName, initialMarks = [], initialDisplayUrl = "your-app.com" }) {
  const bootstrap = JSON.stringify({
    token,
    duration,
    width,
    height,
    preset: preset || "midnight",
    videoName,
    initialMarks,
    initialDisplayUrl,
  })
    .replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TabRetake Mark Studio</title>
  <style>
    :root { --bg:#0b0f17; --panel:#121826; --line:#243046; --text:#eef2f8; --muted:#94a3b8; --accent:#6c5ce7; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; display:flex; flex-direction:column; }
    header { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-bottom:1px solid var(--line); background:var(--panel); }
    header h1 { font-size:15px; margin:0; }
    .meta { color:var(--muted); font-size:12px; }
    main { display:grid; grid-template-columns:1.6fr 1fr; gap:16px; padding:16px 20px; flex:1; min-height:0; }
    @media (max-width:900px) { main { grid-template-columns:1fr; } }
    .stage { display:flex; flex-direction:column; gap:12px; }
    .player-wrap { position:relative; background:#000; border-radius:12px; overflow:hidden; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; }
    video { display:block; max-width:100%; max-height:68vh; width:100%; }
    .overlay { position:absolute; inset:0; cursor:crosshair; }
    .pin { position:absolute; width:20px; height:20px; border-radius:50%; border:2px solid #fff; background:rgba(108,92,231,0.55); transform:translate(-50%,-50%); pointer-events:none; box-shadow:0 0 0 4px rgba(108,92,231,0.28); }
    .controls { display:flex; flex-wrap:wrap; align-items:center; gap:8px; background:var(--panel); padding:10px 12px; border-radius:10px; border:1px solid var(--line); font-size:13px; }
    .controls button, .actions button { border:0; border-radius:8px; padding:7px 12px; font:inherit; cursor:pointer; background:#1e293b; color:var(--text); }
    .controls button:hover, .actions button:hover { background:#334155; }
    .primary { background:var(--accent)!important; color:#fff!important; font-weight:600; }
    .done { background:#10b981!important; color:#052e16!important; font-weight:600; }
    .sidebar { display:flex; flex-direction:column; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px; }
    .marks { display:flex; flex-direction:column; gap:10px; overflow:auto; max-height:56vh; }
    .mark-row { border:1px solid var(--line); border-radius:9px; padding:10px; background:#0e1420; display:flex; flex-direction:column; gap:8px; }
    .mark-head { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--muted); }
    input, select { width:100%; padding:7px 9px; border-radius:7px; border:1px solid var(--line); background:#090d14; color:var(--text); font:inherit; font-size:13px; }
    .row-opts { display:flex; gap:8px; align-items:center; font-size:12px; color:var(--muted); }
    .row-opts label { display:flex; align-items:center; gap:4px; cursor:pointer; }
    .actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:auto; }
    .status { font-size:12px; color:#93c5fd; min-height:18px; word-break:break-word; }
  </style>
</head>
<body>
  <header>
    <h1>TabRetake Mark Studio</h1>
    <div class="meta" id="meta"></div>
  </header>
  <main>
    <section class="stage">
      <div class="player-wrap">
        <video id="video" src="/video" preload="metadata"></video>
        <div class="overlay" id="overlay" title="Click anywhere on the frame to add a zoom mark"></div>
      </div>
      <div class="controls">
        <button id="play" type="button">Play / Pause</button>
        <button id="back" type="button">-0.1s</button>
        <button id="fwd" type="button">+0.1s</button>
        <input id="seek" type="range" min="0" max="1" step="0.02" value="0" style="flex:1;min-width:140px">
        <span id="time">0.00s</span>
      </div>
      <div class="meta">Tip: Click directly on the video frame to place a mark at the current timestamp. Space toggles play/pause.</div>
    </section>
    <aside class="sidebar">
      <div class="row-opts">
        <label style="flex:1">Display URL <input id="displayUrl" value="your-app.com"></label>
        <label style="width:130px">Preset
          <select id="preset">
            <option value="midnight">midnight</option>
            <option value="daylight">daylight</option>
            <option value="paper">paper</option>
            <option value="slate">slate</option>
          </select>
        </label>
      </div>
      <div class="marks" id="marks"></div>
      <div class="row-opts"><label><input id="vertical" type="checkbox" checked> Also render 9:16 vertical</label></div>
      <div class="status" id="status">Click the video frame to add your first mark.</div>
      <div class="actions">
        <button id="save" type="button">Save JSON</button>
        <button id="render" class="primary" type="button">Save &amp; Render</button>
        <button id="done" class="done" type="button">Finish &amp; Close</button>
      </div>
    </aside>
  </main>
  <script>
    const BOOT = ${bootstrap};
    const video = document.getElementById("video");
    const overlay = document.getElementById("overlay");
    const seek = document.getElementById("seek");
    const timeEl = document.getElementById("time");
    const marksEl = document.getElementById("marks");
    const statusEl = document.getElementById("status");
    const presetEl = document.getElementById("preset");
    const displayUrlEl = document.getElementById("displayUrl");
    const verticalEl = document.getElementById("vertical");
    presetEl.value = BOOT.preset;
    displayUrlEl.value = BOOT.initialDisplayUrl || "your-app.com";
    document.getElementById("meta").textContent = BOOT.videoName + " · " + BOOT.width + "×" + BOOT.height + " · " + BOOT.duration.toFixed(2) + "s";

    let marks = Array.isArray(BOOT.initialMarks) ? BOOT.initialMarks.map((m) => ({
      t: Number(m.t || 0),
      x: Number(m.x ?? 0.5),
      y: Number(m.y ?? 0.5),
      duration: Number(m.duration ?? 0.2),
      caption: m.caption || "",
      zoom: m.zoom !== false,
    })) : [];
    const round3 = (n) => Math.round(n * 1000) / 1000;
    const round2 = (n) => Math.round(n * 100) / 100;

    function syncTime() {
      const cur = video.currentTime || 0;
      const dur = video.duration || BOOT.duration || 1;
      seek.max = String(dur);
      seek.value = String(cur);
      timeEl.textContent = cur.toFixed(2) + "s / " + dur.toFixed(2) + "s";
    }

    function renderMarks() {
      overlay.innerHTML = "";
      marksEl.innerHTML = "";
      marks.sort((a, b) => a.t - b.t);
      marks.forEach((mark, i) => {
        const pin = document.createElement("div");
        pin.className = "pin";
        pin.style.left = (mark.x * 100) + "%";
        pin.style.top = (mark.y * 100) + "%";
        overlay.appendChild(pin);

        const row = document.createElement("div");
        row.className = "mark-row";
        row.innerHTML = \`
          <div class="mark-head">
            <button type="button" data-jump="\${i}" style="padding:2px 7px;background:#1e293b;color:#fff;border:0;border-radius:5px;cursor:pointer">t = \${mark.t.toFixed(2)}s (\${mark.x}, \${mark.y})</button>
            <button type="button" data-del="\${i}" style="padding:2px 7px;background:#7f1d1d;color:#fecaca;border:0;border-radius:5px;cursor:pointer">Remove</button>
          </div>
          <input placeholder="Caption (optional)" value="">
          <div class="row-opts">
            <label><input type="checkbox" \${mark.zoom === false ? "" : "checked"}> Zoom in</label>
            <label>Delay (s) <input type="number" step="0.1" min="0" value="\${mark.duration}" style="width:70px"></label>
          </div>\`;
        const [capInput, zoomCheck, durInput] = row.querySelectorAll("input");
        capInput.value = mark.caption || "";
        capInput.addEventListener("input", () => { mark.caption = capInput.value; });
        zoomCheck.addEventListener("change", () => { mark.zoom = zoomCheck.checked; });
        durInput.addEventListener("input", () => { mark.duration = Math.max(0, Number(durInput.value || 0)); });
        row.querySelector("[data-jump]").addEventListener("click", () => { video.currentTime = mark.t; syncTime(); });
        row.querySelector("[data-del]").addEventListener("click", () => { marks.splice(i, 1); renderMarks(); });
        marksEl.appendChild(row);
      });
    }

    overlay.addEventListener("click", (e) => {
      video.pause();
      const rect = overlay.getBoundingClientRect();
      const x = round3(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      const y = round3(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)));
      const t = round2(video.currentTime || 0);
      marks.push({ t, x, y, duration: 0.2, caption: "", zoom: true });
      renderMarks();
      statusEl.textContent = "Added mark at t=" + t.toFixed(2) + "s (" + x + ", " + y + ")";
    });

    document.getElementById("play").addEventListener("click", () => video.paused ? video.play() : video.pause());
    document.getElementById("back").addEventListener("click", () => { video.pause(); video.currentTime = Math.max(0, video.currentTime - 0.1); syncTime(); });
    document.getElementById("fwd").addEventListener("click", () => { video.pause(); video.currentTime = Math.min(video.duration || BOOT.duration, video.currentTime + 0.1); syncTime(); });
    seek.addEventListener("input", () => { video.currentTime = Number(seek.value); syncTime(); });
    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("loadedmetadata", syncTime);
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); video.paused ? video.play() : video.pause(); }
    });

    async function postJson(endpoint, body) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tabretake-token": BOOT.token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    }

    const payload = () => ({
      displayUrl: displayUrlEl.value.trim() || "your-app.com",
      preset: presetEl.value,
      marks: marks.map((m) => ({
        t: m.t, x: m.x, y: m.y, duration: m.duration,
        ...(m.caption ? { caption: m.caption } : {}),
        ...(m.zoom === false ? { zoom: false } : {}),
      })),
    });

    document.getElementById("save").addEventListener("click", async () => {
      try {
        const res = await postJson("/api/save", payload());
        statusEl.textContent = "Saved " + res.markCount + " mark(s) to " + res.path;
      } catch (err) { statusEl.textContent = "Error: " + err.message; }
    });
    document.getElementById("render").addEventListener("click", async () => {
      statusEl.textContent = verticalEl.checked ? "Rendering 16:9 + 9:16..." : "Rendering 16:9...";
      try {
        const res = await postJson("/api/render", { ...payload(), vertical: verticalEl.checked });
        const dir = res.renderDir ? " into " + res.renderDir : "";
        statusEl.textContent = "Rendered " + res.artifacts.length + " artifact(s)" + dir + ".";
      } catch (err) { statusEl.textContent = "Error: " + err.message; }
    });
    if (marks.length > 0) renderMarks();
    document.getElementById("done").addEventListener("click", async () => {
      await postJson("/api/save", payload()).catch(() => {});
      await postJson("/api/done", {}).catch(() => {});
      statusEl.textContent = "Done! You can close this tab.";
    });
  </script>
</body>
</html>`;
}

export function buildMarksConfig({ videoPath, outPath, displayUrl, preset, marks = [], existing = null }) {
  const rel = path.relative(path.dirname(outPath), videoPath);
  const video = rel && !path.isAbsolute(rel) ? rel.replace(/\\/g, "/") : videoPath;
  const existingBrand = existing?.brand || {};
  const overridePreset = preset && preset !== existingBrand.preset ? preset : undefined;
  const theme = resolveTheme(existingBrand, overridePreset);
  const brand = {
    preset: theme.preset,
    background: theme.background,
    accent: theme.accent,
    ...(existingBrand.frame ? { frame: existingBrand.frame } : {}),
  };
  const config = {
    ...(existing?.$schema ? { $schema: existing.$schema } : {}),
    ...(existing?.out ? { out: existing.out } : {}),
    ...(existing?.viewport ? { viewport: existing.viewport } : {}),
    ...(existing?.vertical ? { vertical: existing.vertical } : {}),
    ...(existing?.posterAt !== undefined ? { posterAt: existing.posterAt } : {}),
    ...(existing?.zoomDuration !== undefined ? { zoomDuration: existing.zoomDuration } : {}),
    ...(existing?.duration !== undefined ? { duration: existing.duration } : {}),
    ...(existing?.url ? { url: existing.url } : {}),
    displayUrl: displayUrl || existing?.displayUrl || "your-app.com",
    video,
    brand,
    marks: marks.map((m) => ({
      t: Number(m.t ?? 0),
      ...(m.duration !== undefined ? { duration: Number(m.duration) } : {}),
      ...(m.x !== undefined ? { x: Number(m.x) } : {}),
      ...(m.y !== undefined ? { y: Number(m.y) } : {}),
      ...(m.caption ? { caption: String(m.caption) } : {}),
      ...(m.zoom === false ? { zoom: false } : {}),
      ...(m.label ? { label: String(m.label) } : {}),
    })),
  };
  return assertConfig(config, { kind: "marks" });
}

export async function startMarkServer({
  videoPath,
  outPath,
  preset,
  mediaOut,
  port = 0,
  reporter,
} = {}) {
  const resolvedVideo = path.resolve(videoPath);
  const resolvedOut = path.resolve(outPath || "story-video.json");
  const { width, height, duration } = await probeVideoMeta(resolvedVideo);

  const token = crypto.randomBytes(16).toString("hex");
  const artifacts = new Map();
  let rendering = false;
  let resolveDone;
  const donePromise = new Promise((resolve) => { resolveDone = resolve; });

  const pipeStream = (stream, res) => {
    const cleanup = () => {
      if (!stream.destroyed) stream.destroy();
    };
    res.once("close", cleanup);
    stream.once("error", () => {
      if (!res.headersSent) res.writeHead(500).end("Stream error");
      else res.destroy();
    });
    stream.pipe(res);
  };

  let initialMarks = [];
  let initialDisplayUrl = "your-app.com";
  let initialPreset = preset;
  let existingConfig = null;
  try {
    const existing = JSON.parse(await readFile(resolvedOut, "utf8"));
    if (inspectConfig(existing, { kind: "marks" }).ok) {
      existingConfig = existing;
      initialMarks = existing.marks || [];
      if (existing.displayUrl) initialDisplayUrl = existing.displayUrl;
      if (!initialPreset && existing.brand?.preset) initialPreset = existing.brand.preset;
      artifacts.set(resolvedOut, { kind: "marks", path: resolvedOut });
    }
  } catch {
    // No readable existing marks file; start fresh.
  }

  const saveConfig = async (body) => {
    const cfg = buildMarksConfig({
      videoPath: resolvedVideo,
      outPath: resolvedOut,
      displayUrl: body.displayUrl,
      preset: body.preset || preset,
      marks: body.marks || [],
      existing: existingConfig,
    });
    await mkdir(path.dirname(resolvedOut), { recursive: true });
    await writeFile(resolvedOut, JSON.stringify(cfg, null, 2) + "\n", "utf8");
    existingConfig = cfg;
    artifacts.set(resolvedOut, { kind: "marks", path: resolvedOut });
    return cfg;
  };

  const server = createServer(async (req, res) => {
    const reqUrl = (req.url || "/").split("?")[0];
    try {
      if (req.method === "GET" && reqUrl === "/") {
        const html = renderMarkHtml({
          token,
          duration,
          width,
          height,
          preset: initialPreset,
          videoName: path.basename(resolvedVideo),
          initialMarks,
          initialDisplayUrl,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && reqUrl === "/video") {
        const fileStat = await stat(resolvedVideo);
        const total = fileStat.size;
        const ext = path.extname(resolvedVideo).toLowerCase();
        const mime = VIDEO_MIME[ext] || "application/octet-stream";
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match) {
            res.writeHead(416, { "Content-Range": `bytes */${total}` }).end();
            return;
          }
          const start = match[1] ? Number(match[1]) : 0;
          const end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
          if (start > end || start >= total) {
            res.writeHead(416, { "Content-Range": `bytes */${total}` }).end();
            return;
          }
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": mime,
          });
          pipeStream(createReadStream(resolvedVideo, { start, end }), res);
          return;
        }
        res.writeHead(200, {
          "Accept-Ranges": "bytes",
          "Content-Length": total,
          "Content-Type": mime,
        });
        pipeStream(createReadStream(resolvedVideo), res);
        return;
      }

      if (req.method === "POST") {
        if (req.headers["x-tabretake-token"] !== token) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Forbidden" }));
          return;
        }
        const body = await readJsonBody(req);
        if (reqUrl === "/api/save") {
          const cfg = await saveConfig(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, path: resolvedOut, markCount: cfg.marks.length }));
          return;
        }
        if (reqUrl === "/api/render") {
          if (rendering) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Render already in progress; please wait." }));
            return;
          }
          rendering = true;
          try {
            await saveConfig(body);
            const renderDir = mediaOut || (path.dirname(resolvedOut) === process.cwd() ? "demo" : path.join(path.dirname(resolvedOut), "demo"));
            const renderRes = await executeRender({
              config: resolvedOut,
              out: renderDir,
              vertical: Boolean(body.vertical),
              preset: body.preset || preset,
              "no-gif": Boolean(body.noGif),
              zoom: String(body.zoom ?? "1.28"),
            }, { reporter: reporter || createReporter("render", false) });
            for (const item of renderRes.summary.artifacts) artifacts.set(item.path, item);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, path: resolvedOut, renderDir: path.resolve(renderDir), artifacts: renderRes.summary.artifacts }));
          } finally {
            rendering = false;
          }
          return;
        }
        if (reqUrl === "/api/done") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          resolveDone();
          return;
        }
      }

      res.writeHead(404).end("Not found");
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(port || 0), "127.0.0.1", resolve);
  });

  const url = `http://127.0.0.1:${server.address().port}/`;
  return {
    server,
    url,
    token,
    waitForDone: () => donePromise,
    getArtifacts: () => [...artifacts.values()],
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function mark(argv) {
  const { values } = parseCommand("mark", argv);
  const reporter = createReporter("mark", values.json);

  if (!values.video) {
    throw commandError("VIDEO_REQUIRED", "Provide --video recording.mp4", {
      hint: "Pass the path to an existing MP4 or WebM screen recording.",
    });
  }
  if (values.preset) resolveTheme({}, values.preset);

  const session = await startMarkServer({
    videoPath: values.video,
    outPath: values.out,
    preset: values.preset,
    mediaOut: values["media-out"],
    port: Number(values.port || 0),
    reporter,
  });

  reporter.log(`Mark studio running at ${session.url}`);
  if (!values["no-open"]) {
    openSystemBrowser(session.url);
  }
  reporter.log("Click the video frame to place marks, then click 'Finish & Close'.");

  const onSignal = () => session.close().finally(() => process.exit(0));
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    await session.waitForDone();
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    await session.close();
  }

  const artifacts = session.getArtifacts();
  await reporter.success({ artifacts });
  return session.url;
}
