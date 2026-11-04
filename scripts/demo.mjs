import path from "node:path";
import { parseArgs } from "node:util";
import { record } from "./record.mjs";
import { render } from "./render.mjs";
import { startServer } from "./serve.mjs";

export async function demo(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: "string", default: "demo" },
      port: { type: "string", default: "4173" },
    },
  });

  const server = await startServer({
    port: Number(values.port),
    dir: "examples/site",
  });

  try {
    console.log(`Demo site: ${server.url}\n`);
    await record([
      "--config",
      "examples/story.json",
      "--out",
      values.out,
    ]);
    await render(["--config", path.join(values.out, "record.json")]);
  } finally {
    await server.close();
  }
}
