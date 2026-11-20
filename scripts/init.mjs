import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

export async function init(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      out: { type: "string", default: "demo.json" },
    },
  });

  if (!values.url) throw new Error("Provide --url https://your-app.com");
  let url;
  try {
    url = new URL(values.url);
  } catch {
    throw new Error("Use a complete http:// or https:// URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Use a complete http:// or https:// URL");
  }

  const story = {
    url: url.href,
    displayUrl: url.host,
    viewport: { width: 1440, height: 810 },
    initialWait: 700,
    tail: 1200,
    brand: { background: "#070a12", accent: "#6c5ce7" },
    steps: [{ action: "wait", ms: 1500 }],
  };
  const outPath = path.resolve(values.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  try {
    await writeFile(outPath, JSON.stringify(story, null, 2) + "\n", { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Story file already exists; edit it or choose a different --out path");
    }
    throw error;
  }

  console.log(`Created story: ${outPath}`);
  console.log("The starter records a static page. Use plan to find controls, then add click/type steps.");
  console.log("Run record with this config, then render the resulting record.json.");
  return outPath;
}
