# Examples

Two ways to drive demo-reel:

## 1. Record a URL

[`story.json`](story.json) uses a URL and a list of Playwright steps:

```bash
node bin/demo-reel.mjs record --config examples/story.json --out demo
node bin/demo-reel.mjs render --config demo/record.json --vertical
```

The bundled site is served by `node bin/demo-reel.mjs serve --port 4173` or by
`node bin/demo-reel.mjs demo`.

## 2. Use an existing recording

[`story-video.json`](story-video.json) uses a recording plus normalized `marks`:

```bash
node bin/demo-reel.mjs render \
  --config examples/story-video.json \
  --video recording.mp4 \
  --vertical
```

`t` is seconds into the recording. `x` and `y` are `0..1`. Use
`"zoom": false` when the result is elsewhere on screen.

This is the fallback for sites that block automation, and the path for desktop
and mobile apps.

## 3. Real-world example

[`story-clearmark.json`](story-clearmark.json) records `generaly.top`: anchor
navigation, a drag comparison slider and a download section. Useful as a
reference for `drag` and Chinese captions.

```bash
node bin/demo-reel.mjs record --config examples/story-clearmark.json --out demo-clearmark
node bin/demo-reel.mjs render --config demo-clearmark/record.json --out demo-clearmark --vertical
```
