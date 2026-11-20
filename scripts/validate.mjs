import { inspectConfig, readConfig } from "./lib/config.mjs";
import { parseCommand } from "./lib/options.mjs";
import { schemaVersion, version } from "./lib/metadata.mjs";

export async function validate(argv) {
  const { values } = parseCommand("validate", argv);
  if (!values.config) {
    const error = new Error("Provide --config story.json");
    error.code = "CONFIG_REQUIRED";
    throw error;
  }
  const result = { schemaVersion, version, ...inspectConfig(await readConfig(values.config)) };
  if (values.json) console.log(JSON.stringify(result));
  else if (result.ok) console.log(`Valid ${result.kind} config.`);
  else for (const error of result.errors) console.error(`${error.path}: ${error.message}\n  ${error.hint}`);
  if (!result.ok) process.exitCode = 1;
  return result;
}
