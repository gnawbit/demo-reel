import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectConfig } from "../scripts/lib/config.mjs";
import { ffmpeg, probe } from "../scripts/lib/ffmpeg.mjs";
import { buildMarksConfig, startMarkServer } from "../scripts/mark.mjs";

test("buildMarksConfig preserves existing branding, zoomDuration, posterAt and vertical settings", () => {
  const existing = {
    $schema: "https://raw.githubusercontent.com/gnawbit/tabretake/main/schemas/story.schema.json",
    displayUrl: "app.example.com",
    video: "clip.mp4",
    posterAt: 0.25,
    zoomDuration: 0.4,
    brand: { preset: "slate", background: "#101827", accent: "#22c55e", frame: "phone" },
    vertical: { badge: "Demo", titleLines: ["Ship faster"], zoom: 1.8 },
    marks: [{ t: 0.1, x: 0.5, y: 0.5 }],
  };
  const updated = buildMarksConfig({
    videoPath: path.resolve("clip.mp4"),
    outPath: path.resolve("story-video.json"),
    displayUrl: "app.example.com",
    preset: "slate",
    marks: [{ t: 0.2, x: 0.3, y: 0.4, caption: "Updated" }],
    existing,
  });
  assert.equal(updated.posterAt, 0.25);
  assert.equal(updated.zoomDuration, 0.4);
  assert.equal(updated.brand.frame, "phone");
  assert.equal(updated.brand.background, "#101827");
  assert.deepEqual(updated.vertical, existing.vertical);

  const repainted = buildMarksConfig({
    videoPath: path.resolve("clip.mp4"),
    outPath: path.resolve("story-video.json"),
    displayUrl: "app.example.com",
    preset: "paper",
    marks: [{ t: 0.2, x: 0.3, y: 0.4 }],
    existing,
  });
  assert.equal(repainted.brand.preset, "paper");
  assert.equal(repainted.brand.frame, "phone");
  assert.notEqual(repainted.brand.background, "#101827");
});

test("mark studio serves HTML, streams Range video, saves marks and renders outputs", { timeout: 60000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-mark-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const videoPath = path.join(dir, "clip.mp4");
  await ffmpeg([
    "-f", "lavfi", "-i", "color=c=teal:s=320x180:r=30:d=0.6",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", videoPath,
  ]);

  const outPath = path.join(dir, "story-video.json");
  const mediaOut = path.join(dir, "rendered");
  const session = await startMarkServer({
    videoPath,
    outPath,
    preset: "slate",
    mediaOut,
    port: 0,
  });
  t.after(() => session.close());

  const pageRes = await fetch(session.url);
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  assert.ok(html.includes(session.token));

  const rangeRes = await fetch(`${session.url}video`, {
    headers: { Range: "bytes=0-63" },
  });
  assert.equal(rangeRes.status, 206);
  assert.equal(rangeRes.headers.get("accept-ranges"), "bytes");
  const chunk = await rangeRes.arrayBuffer();
  assert.equal(chunk.byteLength, 64);

  const forbidden = await fetch(`${session.url}api/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ marks: [] }),
  });
  assert.equal(forbidden.status, 403);

  const saveRes = await fetch(`${session.url}api/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tabretake-token": session.token },
    body: JSON.stringify({
      displayUrl: "demo.local",
      preset: "paper",
      marks: [{ t: 0.1, x: 0.4, y: 0.5, duration: 0, caption: "Focus point" }],
    }),
  });
  assert.equal(saveRes.status, 200);
  const savedCfg = JSON.parse(await readFile(outPath, "utf8"));
  assert.equal(inspectConfig(savedCfg, { kind: "marks" }).ok, true);
  assert.equal(savedCfg.video, "clip.mp4");
  assert.equal(savedCfg.brand.preset, "paper");
  assert.equal(savedCfg.marks[0].caption, "Focus point");

  const renderRes = await fetch(`${session.url}api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tabretake-token": session.token },
    body: JSON.stringify({
      displayUrl: "demo.local",
      preset: "paper",
      noGif: true,
      vertical: true,
      marks: [{ t: 0.1, x: 0.4, y: 0.5, duration: 0, caption: "Focus point" }],
    }),
  });
  assert.equal(renderRes.status, 200);
  const renderPayload = await renderRes.json();
  assert.equal(renderPayload.ok, true);
  assert.ok(renderPayload.artifacts.some((a) => a.kind === "video" && a.layout === "landscape"));
  assert.ok(renderPayload.artifacts.some((a) => a.kind === "video" && a.layout === "vertical"));

  const probed = await probe(path.join(mediaOut, "demo-16x9.mp4"));
  assert.equal(probed.streams.find((s) => s.codec_type === "video").width, 1920);

  const doneRes = await fetch(`${session.url}api/done`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tabretake-token": session.token },
    body: "{}",
  });
  assert.equal(doneRes.status, 200);
  await session.waitForDone();

  // Reopening mark studio on an existing story-video.json preloads saved marks
  const reopened = await startMarkServer({ videoPath, outPath, port: 0 });
  t.after(() => reopened.close());
  const reopenedHtml = await (await fetch(reopened.url)).text();
  assert.ok(reopenedHtml.includes("Focus point"));
  assert.ok(reopenedHtml.includes("demo.local"));
});
