import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/demo-reel.mjs", import.meta.url));

test("an agent can plan, initialize, record, render and recover through JSON", { timeout: 90000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "demo-reel-agent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><button>Create</button><input name="project" value="private-initial-value">');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const run = (args) => exec(process.execPath, [cli, ...args, "--json"], { cwd: dir, windowsHide: true, timeout: 45000 });
  async function success(command, args) {
    const { stdout, stderr } = await run([command, ...args]);
    const result = JSON.parse(stdout);
    assert.equal(result.command, command);
    assert.equal(result.ok, true);
    assert.equal(result.schemaVersion, 1);
    assert.ok(!stderr.includes("private-initial-value"));
    for (const artifact of result.artifacts) {
      assert.ok(path.isAbsolute(artifact.path));
      assert.equal(artifact.bytes, (await stat(artifact.path)).size);
      assert.ok(artifact.bytes > 0);
    }
    return result;
  }
  const plan = await success("plan", ["--url", url]);
  assert.equal(plan.elementCount, 2);
  const initialized = await success("init", ["--url", url]);
  const file = initialized.artifacts[0].path;
  const story = JSON.parse(await readFile(file, "utf8"));
  story.initialWait = 0;
  story.tail = 500;
  story.out = "output";
  story.steps = [{ action: "type", selector: "input", value: "Launch", pause: 20 },
    { action: "screenshot", file: "result.png" }];
  await writeFile(file, JSON.stringify(story));
  const recorded = await success("record", ["--config", file]);
  assert.equal(recorded.eventCount, 1);
  assert.equal(recorded.artifacts.length, 3);
  const timeline = recorded.artifacts.find((a) => a.kind === "timeline").path;
  await writeFile(path.join(dir, "output/demo.gif"), "stale gif");
  const rendered = await success("render", ["--config", timeline, "--no-gif", "--vertical"]);
  assert.equal(rendered.artifacts.length, 4);
  assert.deepEqual(rendered.artifacts.filter((a) => a.kind === "video").map((a) => [a.width, a.height]), [[1920, 1080], [1080, 1920]]);
  assert.ok(rendered.artifacts.every((a) => a.kind !== "gif"), "do not report stale output from earlier runs");

  for (const [step, code] of [
    [{ action: "type", selector: "#missing", value: "private-typed-value" }, "TARGET_NOT_FOUND"],
    [{ action: "waitFor", selector: "#missing", timeout: 20 }, "STEP_TIMEOUT"],
  ]) {
    story.steps = [{ action: "wait", ms: 10 }, step];
    await writeFile(file, JSON.stringify(story));
    await assert.rejects(run(["record", "--config", file]), (error) => {
      const result = JSON.parse(error.stdout);
      assert.equal(error.code, 1);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, code);
      assert.deepEqual(result.error.step, { index: 1, action: step.action, path: "/steps/1" });
      assert.ok(result.error.hint);
      assert.ok(!`${error.stdout}${error.stderr}`.includes("private-typed-value"));
      assert.equal(result.artifacts, undefined);
      return true;
    });
  }
  story.steps = [{ action: "type", selector: "input", value: "Recovered", pause: 20 }];
  await writeFile(file, JSON.stringify(story));
  assert.equal((await success("record", ["--config", file])).eventCount, 1);
});

test("JSON login and schema errors fail before browser interaction", async () => {
  for (const command of ["plan", "record"]) {
    await assert.rejects(exec(process.execPath, [cli, command, "--login", "--json"], { windowsHide: true }), (error) => {
      const result = JSON.parse(error.stdout);
      assert.equal(result.error.code, "INTERACTIVE_LOGIN_REQUIRED");
      assert.match(result.error.hint, /--storage-state/);
      return true;
    });
  }
  await assert.rejects(exec(process.execPath, [cli, "record", "--url", "https://example.com", "--json"], { windowsHide: true }), (error) => {
    const result = JSON.parse(error.stdout);
    assert.equal(result.error.code, "INVALID_CONFIG");
    assert.ok(result.error.issues.some((issue) => issue.path === "/steps"));
    return true;
  });
});
