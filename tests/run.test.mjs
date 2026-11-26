import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { FFMPEG, probe } from "../scripts/lib/ffmpeg.mjs";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/tabretake.mjs", import.meta.url));

test("run executes record + render in one command with HiDPI scale and select action", { timeout: 120000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-run-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html>
      <select id="plan">
        <option value="basic">Basic</option>
        <option value="pro">Pro</option>
      </select>
      <button id="apply">Apply</button>
      <div id="status">Idle</div>
      <script>
        document.getElementById("apply").addEventListener("click", () => {
          document.getElementById("status").textContent = "Plan: " + document.getElementById("plan").value;
        });
      </script>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const storyPath = path.join(dir, "story.json");
  await writeFile(storyPath, JSON.stringify({
    url: `http://127.0.0.1:${server.address().port}`,
    viewport: { width: 640, height: 360 },
    scale: 2,
    initialWait: 0,
    tail: 300,
    brand: { preset: "daylight", frame: "phone" },
    steps: [
      { action: "select", selector: "#plan", value: "pro", caption: "Pick Pro", pause: 200 },
      { action: "click", selector: "#apply", caption: "Apply plan", pause: 200 },
      { action: "focus", selector: "#status", caption: "Ready", pause: 300 },
    ],
  }));

  const outDir = path.join(dir, "out");
  const { stdout } = await exec(process.execPath, [
    cli, "run", "--config", storyPath, "--out", outDir, "--vertical", "--no-gif", "--json",
  ], { cwd: dir, windowsHide: true, timeout: 90000 });

  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  assert.equal(result.command, "run");
  assert.equal(result.eventCount, 3);
  assert.ok(result.artifacts.some((a) => a.kind === "timeline"));
  assert.ok(result.artifacts.some((a) => a.kind === "video" && a.layout === "landscape"));
  assert.ok(result.artifacts.some((a) => a.kind === "video" && a.layout === "vertical"));

  const timeline = JSON.parse(await readFile(path.join(outDir, "record.json"), "utf8"));
  assert.equal(timeline.scale, 2);
  assert.deepEqual(timeline.events.map((e) => e.action), ["select", "click", "focus"]);

  const rawInfo = await probe(path.join(outDir, "recording.webm"));
  const rawStream = rawInfo.streams.find((s) => s.codec_type === "video");
  assert.equal(rawStream.width, 1280);
  assert.equal(rawStream.height, 720);

  for (const file of ["demo-16x9.mp4", "demo-9x16.mp4"]) {
    await exec(FFMPEG, ["-v", "error", "-xerror", "-i", path.join(outDir, file), "-f", "null", "-"], {
      windowsHide: true, timeout: 30000,
    });
  }

  // Ensure scale: 2 fills the entire 2x frame (not stuck in top-left quadrant with gray padding).
  const framePng = path.join(outDir, "check-2x.png");
  await exec(FFMPEG, ["-y", "-i", path.join(outDir, "recording.webm"), "-frames:v", "1", framePng]);
  const pixel = await sharp(framePng).extract({ left: 1100, top: 650, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.ok(pixel[0] > 230 && pixel[1] > 230 && pixel[2] > 230, `2x HiDPI frame must fill bottom-right cleanly, got ${[...pixel]}`);
});

test("run supports marks configs directly and validates before running", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-run-marks-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const badPath = path.join(dir, "bad.json");
  await writeFile(badPath, JSON.stringify({ url: "https://example.com", steps: [{ action: "bad" }] }));
  await assert.rejects(
    exec(process.execPath, [cli, "run", "--config", badPath, "--json"], { cwd: dir, windowsHide: true }),
    (error) => JSON.parse(error.stdout).error.code === "INVALID_CONFIG",
  );

  const source = path.join(dir, "source.mp4");
  await exec(FFMPEG, ["-y", "-f", "lavfi", "-i", "color=c=navy:s=320x180:r=30:d=0.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", source]);
  const marksPath = path.join(dir, "marks.json");
  await writeFile(marksPath, JSON.stringify({
    video: "source.mp4",
    marks: [{ t: 0.1, x: 0.5, y: 0.5, duration: 0, caption: "Zoom" }],
  }));

  const { stdout } = await exec(process.execPath, [
    cli, "run", "--config", marksPath, "--out", path.join(dir, "out"), "--no-gif", "--json",
  ], { cwd: dir, windowsHide: true, timeout: 60000 });
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  assert.equal(result.eventCount, undefined);
  assert.ok(result.artifacts.some((a) => a.kind === "video" && a.layout === "landscape"));
});
