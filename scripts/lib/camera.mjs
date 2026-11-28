const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const ease = (progress) => (1 - Math.cos(Math.PI * clamp(progress, 0, 1))) / 2;
const number = (value) => Number(value.toFixed(8)).toString();

export function buildCameraFilter({
  events, durationSec, videoW, videoH, contentW, contentH,
  scale = 1, zoom = 1.28, transition = 0.35, videoOffset = 0,
}) {
  if (transition > 0) transition = Math.max(transition, 1 / 30);
  // Work at twice the output size so integer crop positions move in half pixels.
  const width = contentW * 2;
  const height = contentH * 2;
  const fit = Math.min(width / videoW, height / videoH);
  const sourceW = Math.max(1, Math.round(videoW * fit));
  const sourceH = Math.max(1, Math.round(videoH * fit));
  const left = Math.floor((width - sourceW) / 2);
  const top = Math.floor((height - sourceH) / 2);
  const baseZoom = Math.max(width / sourceW, height / sourceH);
  if (baseZoom * zoom > 10) {
    throw new Error("Zoom is too large for this video aspect ratio; reduce --zoom");
  }

  const overview = { z: baseZoom, x: left + sourceW / 2, y: top + sourceH / 2 };
  const moves = [];
  for (const event of events.filter((event) => (
    Number.isFinite(event.t) && event.t >= 0 && event.t < durationSec * 1000 &&
    (event.zoom === false || (Number.isFinite(event.x) && Number.isFinite(event.y)))
  )).sort((a, b) => a.t - b.t)) {
    const start = event.t / 1000;
    const previous = moves.at(-1);
    const from = previous ? Object.fromEntries(["z", "x", "y"].map((key) => [
      key, previous.from[key] + (previous.to[key] - previous.from[key]) *
        (transition === 0 ? 1 : ease((start - previous.start) / transition)),
    ])) : overview;
    const z = baseZoom * zoom;
    const to = event.zoom === false ? overview : {
      z,
      x: clamp(left + event.x * scale * sourceW / videoW, left + width / z / 2, left + sourceW - width / z / 2),
      y: clamp(top + event.y * scale * sourceH / videoH, top + height / z / 2, top + sourceH - height / z / 2),
    };
    moves.push({ start, from, to });
  }

  // Fast path: when source matches content aspect and no zoom/pan occurs, skip 2x zoompan.
  const isStaticOverview =
    Math.abs(baseZoom - 1) < 0.01 &&
    (moves.length === 0 || (zoom === 1 && moves.every((move) => Math.abs(move.to.z - 1) < 1e-6)));

  if (isStaticOverview) {
    return {
      moves,
      filter: [
        `trim=start=${number(videoOffset)}:end=${number(videoOffset + durationSec)}`,
        "setpts=PTS-STARTPTS",
        "fps=30",
        `scale=${contentW}:${contentH}:flags=lanczos`,
        "setsar=1",
      ].join(","),
    };
  }

  const expression = (key) => moves.reduce((prior, move) => {
    const progress = `(1-cos(PI*clip((on/30-${number(move.start)})/${number(transition)},0,1)))/2`;
    const value = transition === 0 ? number(move.to[key]) :
      `${number(move.from[key])}+(${number(move.to[key] - move.from[key])})*(${progress})`;
    return `if(gte(on/30,${number(move.start)}),${value},${prior})`;
  }, number(overview[key]));

  return {
    moves,
    filter: [
      `trim=start=${number(videoOffset)}:end=${number(videoOffset + durationSec)}`,
      "setpts=PTS-STARTPTS", "fps=30", "format=yuv444p",
      `scale=${sourceW}:${sourceH}:flags=lanczos`,
      `pad=${width}:${height}:${left}:${top}`,
      `zoompan=z='${expression("z")}':x='(${expression("x")})-iw/zoom/2':` +
        `y='(${expression("y")})-ih/zoom/2':d=1:s=${contentW}x${contentH}:fps=30`,
      "setsar=1",
    ].join(","),
  };
}
