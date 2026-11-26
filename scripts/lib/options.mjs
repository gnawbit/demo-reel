import { parseArgs } from "node:util";

export const commandOptions = {
  setup: { "with-deps": { type: "boolean", default: false } },
  init: {
    json: { type: "boolean", default: false },
    url: { type: "string" },
    out: { type: "string", default: "demo.json" },
    auto: { type: "boolean", default: false },
    browser: { type: "string", default: "auto" },
    preset: { type: "string" },
  },
  plan: {
    json: { type: "boolean", default: false },
    url: { type: "string" },
    out: { type: "string", default: "plan.json" },
    login: { type: "boolean", default: false },
    "storage-state": { type: "string" },
    proxy: { type: "string" },
    viewport: { type: "string" },
    headless: { type: "boolean", default: true },
    browser: { type: "string", default: "auto" },
  },
  record: {
    json: { type: "boolean", default: false },
    config: { type: "string" },
    url: { type: "string" },
    out: { type: "string" },
    login: { type: "boolean", default: false },
    "storage-state": { type: "string" },
    "save-state": { type: "string" },
    proxy: { type: "string" },
    viewport: { type: "string" },
    headed: { type: "boolean", default: false },
    browser: { type: "string", default: "auto" },
  },
  render: {
    json: { type: "boolean", default: false },
    config: { type: "string" },
    video: { type: "string" },
    out: { type: "string" },
    "no-gif": { type: "boolean", default: false },
    "no-captions": { type: "boolean", default: false },
    vertical: { type: "boolean", default: false },
    zoom: { type: "string", default: "1.28" },
    "vertical-zoom": { type: "string" },
    "zoom-duration": { type: "string" },
    "poster-at": { type: "string" },
    preset: { type: "string" },
  },
  serve: {
    port: { type: "string", default: "4173" },
    dir: { type: "string", default: "examples/site" },
  },
  demo: {
    out: { type: "string", default: "demo" },
    port: { type: "string", default: "4173" },
    story: { type: "string", default: "onboarding" },
    browser: { type: "string", default: "auto" },
    preset: { type: "string" },
  },
  doctor: { json: { type: "boolean", default: false } },
  capabilities: { json: { type: "boolean", default: false } },
  validate: { config: { type: "string" }, json: { type: "boolean", default: false } },
};

commandOptions.preview = {
  ...commandOptions.record,
  headless: { type: "boolean", default: false },
};

export function parseCommand(command, argv) {
  return parseArgs({ args: argv, options: commandOptions[command], strict: true, allowPositionals: false });
}
