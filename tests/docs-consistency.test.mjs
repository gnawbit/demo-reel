import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function stripFencedCodeBlocks(markdown) {
  return markdown.replace(/^```[\s\S]*?^```/gm, "");
}

function extractRelativeTargets(markdown) {
  const cleaned = stripFencedCodeBlocks(markdown);
  const targets = [];

  for (const match of cleaned.matchAll(/!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    targets.push(match[1]);
  }
  for (const match of cleaned.matchAll(/<(?:a|img|source)\b[^>]*\b(?:href|src)="([^"]+)"/gi)) {
    targets.push(match[1]);
  }

  return targets.filter(
    (target) =>
      target &&
      !target.startsWith("#") &&
      !/^(?:https?:|mailto:|data:)/i.test(target),
  );
}

test("package, plugin, skill, docs and site pages stay on the same version", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const plugin = JSON.parse(await readFile(path.join(root, ".claude-plugin/plugin.json"), "utf8"));
  const skill = await readFile(path.join(root, "SKILL.md"), "utf8");
  const siteIndex = await readFile(path.join(root, "site/index.html"), "utf8");

  assert.equal(plugin.version, pkg.version);
  assert.match(skill, new RegExp(`^\\s*version:\\s*"${pkg.version.replace(/\./g, "\\.")}"`, "m"));
  assert.ok(siteIndex.includes(`"softwareVersion": "${pkg.version}"`));

  for (const relPath of [
    "README.md",
    "docs/README.zh-CN.md",
    "site/index.html",
    "site/vikunja/index.html",
    "site/memos/index.html",
    "site/todomvc/index.html",
  ]) {
    const content = await readFile(path.join(root, relPath), "utf8");
    assert.ok(
      content.includes(`@gnawbit/tabretake@${pkg.version}`),
      `${relPath} must reference @gnawbit/tabretake@${pkg.version}`,
    );
  }
});

test("internal links across primary documentation resolve to existing files", async () => {
  const docs = [
    "README.md",
    "docs/README.zh-CN.md",
    "SKILL.md",
    "docs/compatibility.md",
    "docs/adoption.md",
  ];
  for (const relDoc of docs) {
    const absDoc = path.join(root, relDoc);
    const content = await readFile(absDoc, "utf8");
    const docDir = path.dirname(absDoc);
    for (const rawTarget of extractRelativeTargets(content)) {
      const cleanPath = rawTarget.split("#")[0].split("?")[0];
      if (!cleanPath) continue;
      const resolved = path.resolve(docDir, cleanPath);
      assert.ok(
        existsSync(resolved),
        `Broken relative link in ${relDoc}: ${rawTarget} (resolved to ${resolved})`,
      );
    }
  }
});

test("no secondary root README file exists so npm packs only English README.md", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.ok(!pkg.files.some((entry) => /^README\./i.test(entry) && entry !== "README.md"));
  const rootReadmes = readdirSync(root).filter((name) => /^readme(?:\.|$)/i.test(name));
  assert.deepEqual(rootReadmes, ["README.md"]);
});
