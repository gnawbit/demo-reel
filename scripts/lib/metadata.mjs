import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
export const version = pkg.version;
export const name = pkg.name;
export const schemaVersion = 1;
export const nodeRange = pkg.engines.node;

export function supportsNodeVersion(value) {
  const minimum = nodeRange.slice(2).split(".").map(Number);
  const current = value.split(".").map(Number);
  const index = minimum.findIndex((part, i) => part !== current[i]);
  return index < 0 || current[index] > minimum[index];
}
