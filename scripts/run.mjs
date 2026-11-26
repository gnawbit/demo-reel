import path from "node:path";
import { parseCommand } from "./lib/options.mjs";
import { assertConfig, inspectConfig, readConfig } from "./lib/config.mjs";
import { createReporter, requireInteractiveLogin } from "./lib/report.mjs";
import { executeRecord } from "./record.mjs";
import { executeRender } from "./render.mjs";

export async function runPipeline(values, { reporter = createReporter("run", Boolean(values?.json)) } = {}) {
  if (!values.config) {
    throw new Error("Provide --config demo.json");
  }
  const configPath = path.resolve(values.config);
  const raw = await readConfig(configPath);
  const inspected = inspectConfig(raw);
  if (!inspected.ok) {
    assertConfig(raw);
  }

  const artifacts = [];
  let eventCount;
  let renderConfigPath = configPath;

  if (inspected.kind === "story") {
    const recordRes = await executeRecord(values, { command: "record", reporter });
    artifacts.push(...recordRes.summary.artifacts);
    eventCount = recordRes.summary.eventCount;
    renderConfigPath = recordRes.recordPath;
  }

  const renderValues = {
    ...values,
    config: renderConfigPath,
    out: values.out || (inspected.kind === "story" ? path.dirname(renderConfigPath) : undefined),
  };
  const renderRes = await executeRender(renderValues, { reporter });
  artifacts.push(...renderRes.summary.artifacts);

  return {
    duration: renderRes.summary.duration,
    posterAt: renderRes.summary.posterAt,
    ...(eventCount !== undefined ? { eventCount } : {}),
    artifacts,
    outputPath: renderRes.outputPath,
  };
}

export async function run(argv) {
  const { values } = parseCommand("run", argv);
  requireInteractiveLogin(values);
  const reporter = createReporter("run", values.json);
  const result = await runPipeline(values, { reporter });
  const { outputPath, ...summary } = result;
  await reporter.success(summary);
  return outputPath;
}
