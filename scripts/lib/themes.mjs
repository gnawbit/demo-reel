export const BRAND_PRESETS = {
  midnight: {
    preset: "midnight",
    background: "#070a12",
    accent: "#6c5ce7",
    light: false,
    frame: {
      bar: "#0D1117",
      border: "#2A3140",
      divider: "#202634",
      addressBg: "#161B23",
      addressBorder: "#262D3A",
      addressText: "#8A93A6",
      shadowAlpha: 0.45,
      edgeOpacity: 0.04,
    },
    caption: {
      fg: "white",
      bg: { r: 11, g: 15, b: 25, alpha: 0.74 },
    },
    chrome: {
      text: "0xE9EDF5",
      muted: "0x8A93A6",
      watermark: "0x5D6678",
      ctaText: "0xFFFFFF",
      badgeBoxAlpha: 0.22,
    },
  },
  daylight: {
    preset: "daylight",
    background: "#f4f6fb",
    accent: "#2563eb",
    light: true,
    frame: {
      bar: "#FFFFFF",
      border: "#D7DFEA",
      divider: "#E6ECF4",
      addressBg: "#F1F5F9",
      addressBorder: "#DCE3EE",
      addressText: "#475569",
      shadowAlpha: 0.16,
      edgeOpacity: 0.6,
    },
    caption: {
      fg: "#0F172A",
      bg: { r: 255, g: 255, b: 255, alpha: 0.92 },
    },
    chrome: {
      text: "0x0F172A",
      muted: "0x475569",
      watermark: "0x64748B",
      ctaText: "0xFFFFFF",
      badgeBoxAlpha: 0.14,
    },
  },
  paper: {
    preset: "paper",
    background: "#f7f3eb",
    accent: "#b45309",
    light: true,
    frame: {
      bar: "#FFFDF9",
      border: "#E4D8C6",
      divider: "#EFE6D8",
      addressBg: "#F5EFE4",
      addressBorder: "#E5D8C5",
      addressText: "#6B5B4B",
      shadowAlpha: 0.15,
      edgeOpacity: 0.55,
    },
    caption: {
      fg: "#292018",
      bg: { r: 255, g: 252, b: 245, alpha: 0.92 },
    },
    chrome: {
      text: "0x292018",
      muted: "0x6B5B4B",
      watermark: "0x8C7B6A",
      ctaText: "0xFFFFFF",
      badgeBoxAlpha: 0.14,
    },
  },
  slate: {
    preset: "slate",
    background: "#0f172a",
    accent: "#10b981",
    light: false,
    frame: {
      bar: "#131C31",
      border: "#2B3954",
      divider: "#222E46",
      addressBg: "#1A253D",
      addressBorder: "#30405E",
      addressText: "#94A3B8",
      shadowAlpha: 0.42,
      edgeOpacity: 0.05,
    },
    caption: {
      fg: "white",
      bg: { r: 15, g: 23, b: 42, alpha: 0.8 },
    },
    chrome: {
      text: "0xF1F5F9",
      muted: "0x94A3B8",
      watermark: "0x64748B",
      ctaText: "0xFFFFFF",
      badgeBoxAlpha: 0.22,
    },
  },
};

export const PRESET_NAMES = Object.keys(BRAND_PRESETS);

export function resolveTheme(brand = {}, overridePreset) {
  const presetName = overridePreset || brand?.preset || "midnight";
  const base = BRAND_PRESETS[presetName];
  if (!base) {
    throw new Error(`Unknown brand preset "${presetName}". Choose ${PRESET_NAMES.join(", ")}.`);
  }
  return {
    ...base,
    background: (!overridePreset && brand?.background) || base.background,
    accent: (!overridePreset && brand?.accent) || base.accent,
  };
}
