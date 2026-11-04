---
name: demo-reel
description: Turn any URL or screen recording into a polished 15–25 second demo video and GIF for a README, landing page, X, Product Hunt or App Store. Use when the user asks for a product demo, launch video, README GIF, social clip, or wants to show a web app in action.
---

# demo-reel

Turn a URL into a polished demo video and GIF.

The skill drives a real Chromium browser with Playwright, records the page,
zooms into each click, adds a cursor, captions, a browser frame and a
background, then renders MP4 + GIF with ffmpeg.

## When to use this skill

Use it when the user wants:

- a demo GIF for a README
- a launch video for Product Hunt, X, LinkedIn or a landing page
- a short product walkthrough
- a social clip of a web app
- a repeatable demo that can be regenerated when the UI changes

Do **not** use it to record sites the user does not own or have permission to
record.

## Prerequisites

Run this first:

```bash
node bin/demo-reel.mjs doctor
```

It checks Node, ffmpeg, ffprobe, Playwright Chromium and a caption font.
If Chromium is missing:

```bash
npx playwright install chromium
```

## Workflow

### 1. Inspect the page (optional, but recommended)

```bash
node bin/demo-reel.mjs plan --url https://your-app.com
```

This creates `plan.json` with:

- a screenshot (`plan.png`)
- the page title
- visible interactive elements: tag, text, role, placeholder, selector, position

Read `plan.json` to choose 3–5 steps. Prefer elements with clear text.

If the page requires login:

```bash
node bin/demo-reel.mjs plan --url https://your-app.com --login
```

A visible browser opens. The user logs in manually. The session is saved to
`auth.json` and reused for recording.

### 2. Write `demo.json`

Create a config with 3–5 steps. Keep the whole demo between 12 and 25 seconds.

```json
{
  "url": "https://your-app.com",
  "viewport": { "width": 1440, "height": 810 },
  "initialWait": 900,
  "tail": 1200,
  "brand": {
    "background": "#070a12",
    "accent": "#6c5ce7"
  },
  "steps": [
    { "action": "wait", "ms": 600 },
    {
      "action": "click",
      "text": "New project",
      "pause": 800,
      "caption": "Start in one click"
    },
    {
      "action": "type",
      "selector": "input[name=project-name]",
      "value": "Q4 Launch",
      "pause": 500,
      "caption": "Give it a name"
    },
    {
      "action": "click",
      "text": "Create project",
      "pause": 1400,
      "caption": "Your workspace is ready"
    }
  ]
}
```

#### Step actions

| Action | Fields | What it does |
|---|---|---|
| `wait` | `ms` | Pause |
| `goto` | `url`, `pause` | Navigate |
| `click` | `selector` or `text`/`role`/`name`, `pause`, `caption` | Move the cursor, click |
| `type` | locator + `value`, `pause`, `caption` | Click, clear, type |
| `hover` | locator, `pause`, `caption` | Move the cursor and hover |
| `scroll` | `y`, `pause`, `caption` | Smooth scroll |
| `press` | `key`, `pause`, `caption` | Press a key |
| `waitFor` | `selector`/`text`/`url`, `timeout` | Wait for a state |
| `screenshot` | `file` | Save a screenshot |

#### Locator strategy

Try these in order:

1. `text` — visible label, e.g. `"New project"`
2. `role` + `name` — e.g. `{ "action": "click", "role": "button", "name": "Create project" }`
3. `selector` — CSS only when text/role is ambiguous

Avoid brittle selectors like `div > div:nth-child(4) > button`.

#### Storytelling rules

- 3–5 steps. One idea per step.
- Start with the product already loaded; don't show a blank page.
- Show a state change: create something, open a panel, run a query, see a result.
- Add a short `wait` after an action (600–1000ms) so the result and caption can land.
- Use `"zoom": false` when the interesting result is elsewhere on screen (e.g. a
  modal opening, a card appearing). The renderer will pull back to a full frame.
- Captions state the benefit, not the UI label:
  - Good: "Ship a landing page in 30 seconds"
  - Bad: "Click the button"
- Keep captions under 60 characters.
- End on the result, not on a menu.
- No audio in v0.1.

### 3. Record

```bash
node bin/demo-reel.mjs record --config demo.json --out demo
```

Outputs:

- `demo/recording.webm` — raw recording
- `demo/record.json` — timeline, click events, captions

Options:

```bash
--login                 # open a visible browser, log in once
--storage-state auth.json
--proxy http://127.0.0.1:10808
--viewport 1440x810
--headed                # watch the recording happen
```

### 4. Render

```bash
node bin/demo-reel.mjs render --config demo/record.json
```

Outputs:

- `demo/demo-16x9.mp4`
- `demo/demo-9x16.mp4` (with `--vertical`)
- `demo/demo.gif`
- `demo/demo-9x16.gif` (with `--vertical`)
- `demo/poster.png`
- `demo/poster-9x16.png` (with `--vertical`)

Options:

```bash
--vertical            # also render 9:16 + vertical GIF
--video recording.mp4 # render an existing recording; the config needs "marks"
--no-gif
--no-captions
--zoom 1.28
```

The vertical layout shows a `PRODUCT DEMO` pill and the domain at the top, the
recording in a rounded card in the middle, and larger captions near the bottom.
Keep vertical captions under ~40 characters so they do not clip.

### 5. Inspect and iterate

Look at `poster.png` and the MP4. If a step is wrong:

- fix the step in `demo.json`
- re-run `record`
- re-run `render`

Rendering is deterministic; recording is the only part that needs the browser.

## Login and protected pages

Preferred flow:

```bash
node bin/demo-reel.mjs record --config demo.json --login
```

The user logs in manually in a visible browser. Never ask for passwords or
2FA codes in chat. The session is stored locally in `auth.json`.

For CI or repeat runs:

```bash
node bin/demo-reel.mjs record --config demo.json --storage-state auth.json
```

## When the URL cannot be recorded

Some sites block automation, require a captcha, or use a canvas-only UI. Fall
back to a screen recording instead of trying to bypass the block.

1. Ask the user to record the flow with OBS, Screen Studio, QuickTime or the OS
   recorder.
2. Ask for the moments where the demo should zoom in. Build a `marks` config:

```json
{
  "displayUrl": "your-app.com",
  "video": "recording.mp4",
  "marks": [
    {
      "t": 2.1,
      "x": 0.946,
      "y": 0.048,
      "caption": "Start in one click",
      "zoom": false
    },
    {
      "t": 4.1,
      "x": 0.5,
      "y": 0.468,
      "caption": "Give it a name"
    }
  ]
}
```

3. Render with the recording:

```bash
node bin/demo-reel.mjs render --config story-video.json --video recording.mp4 --vertical
```

`t` is seconds into the recording. `x` and `y` are normalized `0..1`. Set
`"zoom": false` when the interesting result is elsewhere on screen. `duration`
controls how long the caption holds (default `0.6`).

If the user cannot provide timestamps, offer to watch the recording with them
and write the marks together. Do not guess silently.

Do not try to bypass captchas or anti-bot systems.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not find a visible element` | Run `plan`, copy the exact text or selector |
| Page is blank in the video | Increase `initialWait`; wait for a selector |
| Click happens too early | Add `waitFor` before the click |
| Video looks blurry | Use a larger viewport (e.g. 1920x1080); the renderer downscales to 1600x900 |
| Captions are missing | Run `doctor`; check the system font |
| ffmpeg error | Run `doctor`; reinstall dependencies |
| Login state expired | Re-run with `--login` |
| Element is inside an iframe | Use a selector inside the frame; if it fails, fall back to a recording |

## Guardrails

- Only record pages the user owns or has explicit permission to record.
- Do not upload cookies, auth state or recordings to a third party.
- Do not use this skill to scrape, bypass paywalls, or evade anti-bot systems.
- Keep the generated files in the project; they may contain customer data.

## Files

```
bin/demo-reel.mjs          CLI entry
scripts/plan.mjs           inspect a page
scripts/record.mjs         record a story
scripts/render.mjs         compose MP4/GIF
scripts/doctor.mjs         environment checks
examples/story.json        sample story
examples/site/             local demo app
```
