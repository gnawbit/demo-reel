import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { record } from "./record.mjs";
import { render } from "./render.mjs";
import { startServer } from "./serve.mjs";

export async function demo(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: "string", default: "demo" },
      port: { type: "string", default: "4173" },
      story: { type: "string", default: "onboarding" },
    },
  });

  const stories = new Map([
    ["onboarding", "../examples/story.json"],
    ["readme", "../examples/stories/readme.json"],
    ["release", "../examples/stories/release.json"],
  ]);
  if (!stories.has(values.story)) {
    throw new Error("Unknown demo story. Choose readme, onboarding or release.");
  }

  const server = await startServer({
    port: Number(values.port),
    dir: "examples/site",
  });

  try {
    console.log(`Demo site: ${server.url}\n`);
    await record([
      "--config",
      fileURLToPath(new URL(stories.get(values.story), import.meta.url)),
      "--url",
      server.url,
      "--out",
      values.out,
    ]);
    await render(["--config", path.join(values.out, "record.json"), "--vertical"]);
  } finally {
    await server.close();
  }
}
