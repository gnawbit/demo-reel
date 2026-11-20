#!/usr/bin/env node
import { main } from "../scripts/cli.mjs";
import { schemaVersion, version } from "../scripts/lib/metadata.mjs";

main(process.argv.slice(2)).catch((err) => {
  const [command, ...args] = process.argv.slice(2);
  if (["doctor", "capabilities"].includes(command) && args.includes("--json")) {
    console.log(JSON.stringify({ schemaVersion, version, ok: false, error: {
      code: err.code || "COMMAND_FAILED", message: err.message || String(err),
    } }));
  } else console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
