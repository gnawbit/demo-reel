import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import Ajv from "ajv";

const configSchema = JSON.parse(readFileSync(new URL("../../schemas/story.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv({ allErrors: true, strictRequired: false });
ajv.addFormat("uri", (value) => {
  try { new URL(value); return true; } catch { return false; }
});
ajv.addSchema(configSchema);
const validators = Object.fromEntries(["story", "marks", "record"].map((kind) => [
  kind, ajv.getSchema(`${configSchema.$id}#/definitions/${kind}`),
]));
const pointer = (part) => String(part).replace(/~/g, "~0").replace(/\//g, "~1");

export function inspectConfig(config, { kind } = {}) {
  const detected = config && typeof config === "object" && !Array.isArray(config)
    ? ("marks" in config ? "marks" : "events" in config ? "record" : "story") : "story";
  kind ||= detected;
  const validate = validators[kind];
  if (!validate) throw new Error(`Unknown config kind: ${kind}`);
  const ok = validate(config);
  const errors = ok ? [] : validate.errors.filter((error) => error.keyword !== "if").map((error) => {
    const property = error.params.missingProperty ?? error.params.additionalProperty;
    return {
      code: "INVALID_CONFIG",
      path: (error.instancePath + (property === undefined ? "" : `/${pointer(property)}`)) || "/",
      message: error.message,
      hint: "Correct this field using schemas/story.schema.json, then run validate again.",
    };
  });
  if (ok) {
    const duration = config.duration;
    const settings = kind === "record" ? config.config : config;
    const poster = settings?.posterAt;
    if (duration !== undefined && poster !== undefined && poster >= duration) {
      errors.push({ code: "INVALID_CONFIG", path: kind === "record" ? "/config/posterAt" : "/posterAt",
        message: "must be less than duration", hint: "Choose a poster time inside the output timeline." });
    }
    if (kind === "record") {
      config.events.forEach((event, index) => {
        if (event.tEnd !== undefined && event.tEnd < event.t) errors.push({
          code: "INVALID_CONFIG", path: `/events/${index}/tEnd`, message: "must be at least t",
          hint: "Use milliseconds for both event timestamps.",
        });
      });
    }
  }
  return { ok: errors.length === 0, kind, errors };
}

export function assertConfig(config, options) {
  const result = inspectConfig(config, options);
  if (!result.ok) {
    const error = new Error(`Invalid config: ${result.errors.map((e) => `${e.path} ${e.message}`).join("; ")}`);
    error.code = "INVALID_CONFIG";
    error.issues = result.errors;
    throw error;
  }
  return config;
}

export async function readConfig(file) {
  let source;
  try { source = await readFile(file, "utf8"); } catch {
    const error = new Error("Could not read config file; check --config and file permissions.");
    error.code = "CONFIG_READ_FAILED";
    throw error;
  }
  try { return JSON.parse(source); } catch {
    // Do not echo source snippets, which may include typed values or credentials.
    const error = new Error("Config is not valid JSON; check quotes, commas and brackets.");
    error.code = "INVALID_JSON";
    throw error;
  }
}
