#!/usr/bin/env node
import { main } from "../scripts/cli.mjs";

main(process.argv.slice(2)).catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
