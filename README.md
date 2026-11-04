# demo-reel

![demo-reel demo](docs/hero.gif)

**Give it a URL. Get a polished demo video and GIF.**

demo-reel is an agent skill that records your product in a real browser, zooms
into every click, adds a cursor, captions, a browser frame and a background,
then renders a launch-ready MP4 + GIF.

No timeline editing. No screen-studio subscription. One command.

```
/demo-reel https://your-app.com
```

> Status: v0.1. URL input, 16:9 MP4 + GIF. Vertical export and screen-recording
> input are next.

---

## Why

Every launch needs a demo:

- a GIF at the top of the README
- a hero video on the landing page
- a clip for X, LinkedIn, Product Hunt
- a walkthrough for onboarding

Recording one by hand takes 1–3 hours and still looks like a screen recording.
demo-reel turns it into a repeatable command. Change the UI, re-run it, get a
fresh demo.

## Install

As an agent skill:

```bash
npx skills add yanjiangfan/demo-reel
```

From source:

```bash
git clone https://github.com/yanjiangfan/demo-reel
cd demo-reel
npm install
npx playwright install chromium
node bin/demo-reel.mjs doctor
```

Requirements: Node 20+, Chromium (installed by Playwright). ffmpeg and ffprobe
come from npm packages; no system install needed.

## Quickstart

```bash
# 1. Check the environment
node bin/demo-reel.mjs doctor

# 2. See it work on the bundled demo app
node bin/demo-reel.mjs demo

# 3. Use it on your own app
node bin/demo-reel.mjs plan --url https://your-app.com
node bin/demo-reel.mjs record --config demo.json
node bin/demo-reel.mjs render --config demo/record.json
```

Output:

```
demo/
  demo-16x9.mp4
  demo.gif
  poster.png
  record.json
```

## What it does

1. Opens the URL in a real Chromium browser (Playwright).
2. Moves the cursor like a person, clicks the elements in your story.
3. Records the session in the browser.
4. Zooms into each click, adds a cursor trail, captions, a browser frame and a
   background.
5. Renders 1080p MP4 + GIF with ffmpeg.

Because it drives a real browser, it works with React, Vue, Svelte, plain HTML,
SPAs and authenticated pages.

## The story file

```json
{
  "url": "https://your-app.com",
  "viewport": { "width": 1440, "height": 810 },
  "brand": { "background": "#070a12", "accent": "#6c5ce7" },
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

Actions: `wait`, `goto`, `click`, `type`, `hover`, `scroll`, `press`, `waitFor`,
`screenshot`.

Locators, in order of preference:

1. `text` — visible label
2. `role` + `name` — accessible role
3. `selector` — CSS, only when needed

## Commands

| Command | What it does |
|---|---|
| `demo-reel doctor` | Check Node, Chromium, ffmpeg, fonts |
| `demo-reel plan --url <url>` | Screenshot + list interactive elements |
| `demo-reel record --config demo.json` | Record the story |
| `demo-reel render --config demo/record.json` | Render MP4 + GIF |
| `demo-reel serve` | Serve the bundled demo app |
| `demo-reel demo` | Record + render the bundled demo |

Useful flags:

```bash
--login                 # open a visible browser, log in once
--storage-state auth.json
--proxy http://127.0.0.1:10808
--viewport 1440x810
--headed                # watch the recording happen
--no-gif
--no-captions
--zoom 1.28
```

## Login and protected pages

```bash
node bin/demo-reel.mjs record --config demo.json --login
```

A visible browser opens. Log in manually. The session is saved to `auth.json`
locally and reused. demo-reel never asks for your password and never uploads
cookies.

## When a site cannot be recorded

Some sites use captchas, aggressive anti-bot checks, or canvas-only UI. In that
case, record the flow manually and use the recording as the source. (Direct
video input is on the roadmap.)

## How it works

```
SKILL.md                 agent workflow
scripts/plan.mjs         Playwright: screenshot + element inventory
scripts/record.mjs       Playwright: cursor, clicks, video, event timeline
scripts/render.mjs       sharp + ffmpeg: background, frame, zoom, captions
examples/site/           a small demo app used by `demo-reel demo`
```

The renderer crops around each click at 1.28×, concatenates the segments, then
overlays the recording on a generated background and browser frame. Captions are
burned in with ffmpeg `drawtext`.

## FAQ

**Is this a screen recorder?**
No. It is a repeatable pipeline: a story file + a browser + a renderer. The
recording is a side effect.

**Does it work on Windows?**
Yes. It is developed on Windows and uses npm-bundled ffmpeg binaries.

**Do I need an AI agent to use it?**
No. The CLI works standalone. The agent skill is a convenience: it can inspect
the page, write the story and run the commands for you.

**Can I record a site I don't own?**
Only with permission. Do not use it to scrape, bypass paywalls or evade
anti-bot systems.

**Why not Screen Studio?**
Screen Studio is a manual editor. demo-reel is a deterministic, free, MIT
pipeline you can commit, rerun and automate.

## Roadmap

- [ ] 9:16 vertical export
- [ ] Screen-recording input (auto-zoom + captions on existing footage)
- [ ] Voiceover (TTS)
- [ ] Device frames (iPhone, Android, macOS)
- [ ] Multiple brand presets
- [ ] Cloud rendering

## License

MIT
