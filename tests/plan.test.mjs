import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("plan excludes password values from files and logs", { timeout: 30000 }, async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), "tabretake-plan-"));
  t.after(() => rm(out, { recursive: true, force: true }));

  const secret = "dummy-password-for-regression";
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><title>Plan fixture</title>
      <input id="password" type="password" value="${secret}" aria-label="Account password">
      <input id="confirmation" type="PASSWORD" value="${secret}" placeholder="Confirm password">
      <input id="unlabelled" type="password" value="${secret}">
      <input id="project" value="Release demo">
      <div id="rich-editor" contenteditable="true" role="textbox" aria-label="Memo">Draft</div>
      <div id="plain-editor" contenteditable="plaintext-only">Plain draft</div>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const outputPath = path.join(out, "plan.json");
  const { stdout, stderr } = await exec(process.execPath, [
    "bin/tabretake.mjs", "plan",
    "--url", `http://127.0.0.1:${server.address().port}`,
    "--out", outputPath,
  ], { cwd: root, windowsHide: true, timeout: 25000 });

  const json = await readFile(outputPath, "utf8");
  assert.equal(json.includes(secret), false, "plan.json must not contain the password");
  assert.equal((stdout + stderr).includes(secret), false, "logs must not contain the password");

  const { elements } = JSON.parse(json);
  const label = (id) => elements.find((el) => el.selector === `#${id}`)?.text;
  assert.equal(label("password"), "Account password");
  assert.equal(label("confirmation"), "Confirm password");
  assert.equal(label("unlabelled"), "");
  assert.equal(label("project"), "Release demo");
  assert.equal(label("rich-editor"), "Memo");
  assert.equal(elements.filter((el) => el.selector === "#rich-editor").length, 1);
  assert.equal(label("plain-editor"), "Plain draft");
});

test("plan reports form labels and native select choices", { timeout: 30000 }, async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), "tabretake-plan-labels-"));
  t.after(() => rm(out, { recursive: true, force: true }));
  const secret = "dummy-labelled-password-for-regression";
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><title>Form labels fixture</title>
      <style>label, input, select, textarea { display: block; margin: 4px; }</style>
      <label for="project"> 项目  名称 </label>
      <input id="project" name="project-name" value="Previous project">
      <span id="plan-title">发布方案</span><span id="plan-hint">请选择</span>
      <select id="plan" name="release-plan" aria-labelledby="plan-title missing-id plan-hint" aria-label="Lower priority">
        <option value="">选择方案</option>
        <option value="basic" label="基础版">Basic fallback</option>
        <option value="paused" disabled>暂停版</option>
        <optgroup label="Unavailable" disabled><option value="pro">专业版</option></optgroup>
      </select>
      <label> 简介 <textarea id="description">Existing description</textarea></label>
      <label>地区<select id="region"><option value="cn">中国</option></select></label>
      <input id="aria" aria-label=" 联系邮箱 " placeholder="Fallback" value="demo@example.com">
      <label for="password">账户密码</label><input id="password" type="password" value="${secret}">
      <label for="combined">联系</label><label for="combined">姓名</label><input id="combined">
      <input id="fallback" aria-labelledby="unknown" aria-label="备用名称">
      <select id="disabled" aria-label="不可用方案" disabled><option value="trial">试用版</option></select>
      <input id="placeholder" placeholder="No label fallback">`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const outputPath = path.join(out, "plan.json");
  const { stdout, stderr } = await exec(process.execPath, [
    "bin/tabretake.mjs", "plan", "--json",
    "--url", `http://127.0.0.1:${server.address().port}`,
    "--out", outputPath,
  ], { cwd: root, windowsHide: true, timeout: 25000 });

  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  const json = await readFile(outputPath, "utf8");
  assert.equal((json + stdout + stderr).includes(secret), false);
  const { elements } = JSON.parse(json);
  const byId = (id) => {
    const element = elements.find((el) => el.selector === `#${id}`);
    assert.ok(element, `Expected #${id} in plan`);
    return element;
  };
  for (const [id, label] of Object.entries({
    project: "项目 名称", plan: "发布方案 请选择", description: "简介", region: "地区",
    aria: "联系邮箱", password: "账户密码", combined: "联系 姓名", fallback: "备用名称",
    disabled: "不可用方案",
  })) {
    assert.equal(byId(id).label, label, `Label for #${id}`);
    assert.equal(byId(id).text, label, `Display text for #${id}`);
  }
  assert.equal(byId("project").name, "project-name");
  assert.equal(byId("plan").name, "release-plan");
  assert.deepEqual(byId("plan").options, [
    { label: "选择方案", value: "", disabled: false },
    { label: "基础版", value: "basic", disabled: false },
    { label: "暂停版", value: "paused", disabled: true },
    { label: "专业版", value: "pro", disabled: true },
  ]);
  assert.deepEqual(byId("disabled").options, [
    { label: "试用版", value: "trial", disabled: true },
  ]);
  assert.equal(byId("placeholder").label, "");
  assert.equal(byId("placeholder").text, "No label fallback");
  assert.equal("options" in byId("project"), false);
});
