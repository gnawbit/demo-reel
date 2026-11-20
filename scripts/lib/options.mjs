import { parseArgs } from "node:util";

export const commandOptions = {
  setup: { "with-deps": { type: "boolean", default: false } },
  init: {
    url: { type: "string" },
    out: { type: "string", default: "demo.json" },
  },
  plan: {
    url: { type: "string" },
    out: { type: "string", default: "plan.json" },
    login: { type: "boolean", default: false },
    "storage-state": { type: "string" },
    proxy: { type: "string" },
    viewport: { type: "string" },
    headless: { type: "boolean", default: true },
  },
  record: {
    config: { type: "string" },
    url: { type: "string" },
    out: { type: "string", default: "demo" },
    login: { type: "boolean", default: false },
    "storage-state": { type: "string" },
    "save-state": { type: "string" },
    proxy: { type: "string" },
    viewport: { type: "string" },
    headed: { type: "boolean", default: false },
  },
  render: {
    config: { type: "string" },
    video: { type: "string" },
    out: { type: "string" },
    "no-gif": { type: "boolean", default: false },
    "no-captions": { type: "boolean", default: false },
    vertical: { type: "boolean", default: false },
    zoom: { type: "string", default: "1.28" },
    "zoom-duration": { type: "string" },
    "poster-at": { type: "string" },
  },
  serve: {
    port: { type: "string", default: "4173" },
    dir: { type: "string", default: "examples/site" },
  },
  demo: {
    out: { type: "string", default: "demo" },
    port: { type: "string", default: "4173" },
    story: { type: "string", default: "onboarding" },
  },
  doctor: { json: { type: "boolean", default: false } },
  capabilities: { json: { type: "boolean", default: false } },
};

export function parseCommand(command, argv) {
  return parseArgs({ args: argv, options: commandOptions[command], strict: true, allowPositionals: false });
}
