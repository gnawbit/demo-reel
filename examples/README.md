# Examples

Three runnable recipes use **Northstar, the fictional app bundled in this repo**.
They illustrate recording workflows, not external customer adoption. No account,
credentials or external service is required.

Run from a source checkout after `npm ci` (uses local Chrome/Edge automatically,
or run `node bin/tabretake.mjs setup` for pinned Chromium).

| Task | Story | Preview |
|---|---|---|
| README GIF: create a project in three interactions | [readme.json](stories/readme.json) | [Result](../docs/examples/readme.webp) |
| First-project onboarding: name, template, result | [story.json](story.json) | [Video](../docs/hero.mp4) |
| Repeat a release demo with Chinese captions and portrait branding | [release.json](stories/release.json) | [Portrait](../docs/examples/release.webp) |

## README GIF

```bash
node bin/tabretake.mjs demo --story readme --port 0 --out demo-readme
```

Use `demo-readme/demo.gif` for a README or `demo-16x9.mp4` for a landing page.
The final card should say **Launch plan**. Inspect the GIF before copying it
into a public docs directory.

## First-project onboarding

```bash
node bin/tabretake.mjs demo --story onboarding --port 0 --out demo-onboarding
```

The four interactions open the form, enter **Q4 Launch**, choose **Campaign**
and create the project. This is also the default `demo` story.

## Refresh release assets

```bash
node bin/tabretake.mjs demo --story release --port 0 --out demo-release
```

The result card says **Release notes**. The 9:16 output demonstrates Chinese
captions and custom title lines; `doctor` reports whether a CJK font is available.
Run the same story into a new output directory after a UI change, then compare
the result and adjust only the locators or copy affected by that change.

To change a poster without recording again:

```bash
node bin/tabretake.mjs render --config demo-release/record.json --poster-at 4 --vertical
```

Each recipe starts and stops its own server. `--port 0` picks an available port.
All recipes export landscape and portrait MP4s, GIFs, posters and `record.json`.

## Adapt a story to your app

Copy a story, replace `url`, `displayUrl`, names and selectors, then run:

```bash
node bin/tabretake.mjs plan --url http://localhost:3000
node bin/tabretake.mjs record --config my-story.json --out demo-my-app
node bin/tabretake.mjs render --config demo-my-app/record.json --vertical
```

Keep a `waitFor` step for the final visible result so a broken flow fails before
rendering. Use a new output directory when keeping an earlier recording for comparison.

## Use an existing recording

[`story-video.json`](story-video.json) uses a recording plus normalized `marks`:

```bash
node bin/tabretake.mjs render \
  --config examples/story-video.json \
  --video recording.mp4 \
  --vertical
```

`t` is seconds into the recording. `x` and `y` are `0..1`. Use
`"zoom": false` when the result is elsewhere on screen.

This is the fallback for sites that block automation, and the path for desktop
and mobile apps.
