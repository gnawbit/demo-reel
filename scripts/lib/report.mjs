import { stat } from "node:fs/promises";
import path from "node:path";
import { schemaVersion, version } from "./metadata.mjs";

export function commandError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

export function requireInteractiveLogin(values) {
  if (values.login && (values.json || !process.stdin.isTTY)) {
    throw commandError("INTERACTIVE_LOGIN_REQUIRED", "Manual login requires an interactive terminal without --json.", {
      hint: "Run plan or record with --login interactively, then pass --storage-state auth.json on automated runs.",
    });
  }
}

export function createReporter(command, json) {
  return {
    log: (...args) => (json ? console.error : console.log)(...args),
    async success({ artifacts, ...details }) {
      if (!json) return;
      const files = await Promise.all(artifacts.map(async (artifact) => {
        const file = path.resolve(artifact.path);
        const info = await stat(file);
        if (!info.isFile() || info.size === 0) throw commandError("ARTIFACT_MISSING", "An expected artifact is missing or empty.");
        return { ...artifact, path: file, bytes: info.size };
      }));
      console.log(JSON.stringify({ schemaVersion, version, command, ok: true, ...details, artifacts: files }));
    },
  };
}

export function errorReport(command, error) {
  return { schemaVersion, version, command, ok: false, error: {
    code: error.code || "COMMAND_FAILED",
    message: error.message || String(error),
    hint: error.hint || "Check the reported input; use doctor --json to diagnose runtime dependencies.",
    ...(error.issues ? { issues: error.issues } : {}),
    ...(error.step ? { step: error.step } : {}),
  } };
}
