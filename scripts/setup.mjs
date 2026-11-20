import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);

export async function setup(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { "with-deps": { type: "boolean", default: false } },
  });
  const cli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
  const args = [cli, "install", "chromium"];
  if (values["with-deps"]) args.push("--with-deps");

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Chromium setup failed (${signal || code})`));
    });
  });
  console.log("Chromium is ready. Run demo-reel demo to make your first video.");
}
