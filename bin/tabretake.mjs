#!/usr/bin/env node
import { main } from "../scripts/cli.mjs";
import { commandOptions } from "../scripts/lib/options.mjs";
import { errorReport } from "../scripts/lib/report.mjs";

main(process.argv.slice(2)).catch((err) => {
  const [command, ...args] = process.argv.slice(2);
  if (commandOptions[command]?.json && args.includes("--json")) {
    console.log(JSON.stringify(errorReport(command, err)));
  } else if (err?.code) {
    console.error(`Error: ${err.message || String(err)}`);
    if (err.hint) console.error(`Hint: ${err.hint}`);
  } else {
    console.error(err?.stack || err?.message || String(err));
  }
  process.exitCode = 1;
});
