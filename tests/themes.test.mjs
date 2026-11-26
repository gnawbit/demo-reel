import assert from "node:assert/strict";
import test from "node:test";
import { BRAND_PRESETS, PRESET_NAMES, resolveTheme } from "../scripts/lib/themes.mjs";

test("resolveTheme returns defaults and supports built-in presets", () => {
  const def = resolveTheme();
  assert.equal(def.preset, "midnight");
  assert.equal(def.background, "#070a12");
  assert.equal(def.light, false);

  for (const name of PRESET_NAMES) {
    const theme = resolveTheme({ preset: name });
    assert.equal(theme.preset, name);
    assert.equal(theme.background, BRAND_PRESETS[name].background);
    assert.ok(theme.caption.fg && theme.caption.bg);
  }
});

test("explicit brand colors override preset defaults, while --preset overrides config", () => {
  const customized = resolveTheme({ preset: "daylight", background: "#ffffff", accent: "#ff5500" });
  assert.equal(customized.preset, "daylight");
  assert.equal(customized.light, true);
  assert.equal(customized.background, "#ffffff");
  assert.equal(customized.accent, "#ff5500");

  const cliOverride = resolveTheme({ preset: "midnight", background: "#111111" }, "paper");
  assert.equal(cliOverride.preset, "paper");
  assert.equal(cliOverride.background, BRAND_PRESETS.paper.background);
  assert.equal(cliOverride.light, true);
});

test("resolveTheme rejects unknown preset names", () => {
  assert.throws(() => resolveTheme({ preset: "neon-invalid" }), /Unknown brand preset/);
});
