import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/tabretake.mjs", import.meta.url));

test("preview executes the story and preserves existing recordings, including on failure", { timeout: 30000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tabretake-preview-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let clicks = 0;
  const server = createServer((req, res) => {
    if (req.url === "/click") clicks++;
    res.setHeader("Content-Type", "text/html");
    res.end('<button onclick="fetch(\'/click\')">Create</button><div id="result" style="margin-top:900px;height:80px">Result</div>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const story = { url: `http://127.0.0.1:${server.address().port}`, viewport:{width:640,height:480}, initialWait:0, tail:0,
    steps:[{action:"click",text:"Create",pause:50},{action:"focus",selector:"#result",pause:0}] };
  const config = path.join(dir, "story.json");
  const out = path.join(dir, "output");
  await mkdir(path.join(out, "raw"), {recursive:true});
  await writeFile(path.join(out, "raw/keep.webm"), "existing recording");
  await writeFile(config, JSON.stringify(story));
  const run = (command) => exec(process.execPath, [cli, command, "--config", config, "--out", out, "--json", ...(command === "preview" ? ["--headless"] : [])], {windowsHide:true, timeout:12000});
  const result = JSON.parse((await run("preview")).stdout);
  assert.equal(result.command, "preview");
  assert.equal(result.stepCount, 2);
  assert.deepEqual(result.artifacts, []);
  assert.equal(clicks, 1);
  assert.deepEqual(await readdir(out), ["raw"]);
  assert.equal(await readFile(path.join(out, "raw/keep.webm"), "utf8"), "existing recording");
  story.steps.push({action:"focus",selector:"#missing"});
  await writeFile(config, JSON.stringify(story));
  await assert.rejects(run("preview"), (error) => {
    const report = JSON.parse(error.stdout);
    assert.equal(report.command, "preview");
    assert.equal(report.error.code, "TARGET_NOT_FOUND");
    assert.equal(report.error.step.index, 2);
    return true;
  });
  assert.equal(await readFile(path.join(out, "raw/keep.webm"), "utf8"), "existing recording");
  story.steps.pop();
  await writeFile(config, JSON.stringify(story));
  await run("record");
  const timeline = JSON.parse(await readFile(path.join(out,"record.json"),"utf8"));
  const focus = timeline.events[1];
  assert.equal(focus.action,"focus");
  assert.ok(focus.y > 0 && focus.y < 480, "measure after scrolling into view");
  assert.equal(focus.t,focus.tEnd);
  assert.equal(clicks,3, "focus does not click its target");
});
