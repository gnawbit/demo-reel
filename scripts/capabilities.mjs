import { commandOptions, parseCommand } from "./lib/options.mjs";
import { name, nodeRange, schemaVersion, version } from "./lib/metadata.mjs";

export function capabilities(argv) {
  const { values } = parseCommand("capabilities", argv);
  const result = {
    schemaVersion, name, version,
    runtime: { node: nodeRange },
    commands: Object.fromEntries(Object.entries(commandOptions).map(([command, options]) => [
      command, { options, json: Boolean(options.json) },
    ])),
    outputs: ["mp4", "gif", "png"],
  };
  if (values.json) console.log(JSON.stringify(result));
  else {
    console.log(`${name} ${version}`);
    for (const [command, { options }] of Object.entries(result.commands)) {
      console.log(`${command}: ${Object.keys(options).map((key) => `--${key}`).join(" ")}`);
    }
  }
  return result;
}
