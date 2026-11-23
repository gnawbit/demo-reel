# demo-reel — repeatable web app demo videos

English · [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.9-339933?logo=node.js&logoColor=white)](package.json)
[![Version](https://img.shields.io/badge/version-0.3.1-6c5ce7)](https://github.com/gnawbit/demo-reel/releases/tag/v0.3.1)
[![Agent skill](https://img.shields.io/badge/agent%20skill-Claude%20Code%20%7C%20Codex%20%7C%20Cursor-6c5ce7)](SKILL.md)
[![GitHub stars](https://img.shields.io/github/stars/gnawbit/demo-reel?style=social)](https://github.com/gnawbit/demo-reel/stargazers)

**Record your web app as a README GIF or portrait launch video.**

<img src="docs/hero.gif" alt="demo-reel recording a SaaS dashboard, zooming into clicks and adding captions" width="100%">

[Watch the demo](docs/hero.mp4) · [Install](#install) · [How it works](#how-it-works) · [Roadmap](#roadmap)

demo-reel is a local CLI and Agent Skill for repeatable browser walkthroughs.
Describe a flow in editable JSON, or have your coding agent write it. It runs
the steps in Chromium and exports landscape or portrait MP4, README GIFs and
PNG posters with click zooms and captions. Works on Windows, macOS and Linux.

Keep the story with your code and re-run it when the UI changes.

[Agent discovery and invocation checks](docs/agent-discovery.md) separate search
visibility, Skill selection and successful output; they are not adoption metrics.

> Works with Claude Code, Codex, Cursor and any agent that supports
> [Agent Skills](https://agentskills.io).

---

## Why

Every launch needs a demo:

- a GIF at the top of the README
- a hero video on the landing page
- a clip for X, LinkedIn, Product Hunt
- a walkthrough for onboarding

Keep these assets reproducible with a story file that you or your agent can
edit and run again after a release.

**What you get**

- 1080p MP4 + GIF + poster, in **16:9 and 9:16**
- automatic zoom into each click
- a visible cursor and click ripple
- benefit-driven captions
- a browser frame and a generated background
- a `record.json` timeline you can re-render without recording again
- everything runs locally — no upload, no cloud

### Formats

| 16:9 — README / landing page | 9:16 — Shorts / Reels / 小红书 |
|---|---|
| <img src="docs/poster.png" alt="16:9 demo poster" width="100%"> | <img src="docs/poster-9x16.png" alt="9:16 vertical demo poster" width="100%"> |

[16:9 MP4](docs/hero.mp4) · [9:16 MP4](docs/hero-9x16.mp4) · [9:16 GIF](docs/hero-9x16.gif)

## Install

Install the CLI directly from this repository:

```bash
npm install --global git+https://github.com/gnawbit/demo-reel.git#v0.3.1
demo-reel setup
demo-reel demo
```

Requires Node 20.9+ and Git. Run `demo-reel` from your working directory;
the bundled demo writes its output to `./demo`. On Linux, use
`demo-reel setup --with-deps` if browser system libraries are missing.
ffmpeg and ffprobe are included as dependencies.

The package identity is `@gnawbit/demo-reel`; distribution is currently through
GitHub. The unscoped npm package `demo-reel` is a different project.

For development, install from a checkout:

```bash
git clone https://github.com/gnawbit/demo-reel
cd demo-reel
npm ci
node bin/demo-reel.mjs setup
node bin/demo-reel.mjs doctor
```

The examples below use the source checkout. With the global installation,
replace `node bin/demo-reel.mjs` with `demo-reel`.

To add the agent workflow after setting up the CLI:

```bash
npx skills@1.9.0 add gnawbit/demo-reel@v0.3.1 --skill demo-reel
```

Run this in the target project; add `--agent codex`, `--agent claude-code` or
`--agent cursor` to select a client. Skills CLI 1.9.0 needs Node 22.20+, while
demo-reel itself needs Node 20.9+. Tell your agent whether to use the global CLI
or a source checkout. Keep the CLI and Skill on the same release.

Claude Code users can install the plugin instead (CLI 2.1.292+):

```bash
claude plugin install demo-reel --marketplace "gnawbit/demo-reel#v0.3.1"
```

Install the workflow through one of these routes; the plugin still needs the
demo-reel runtime installed above. It is a Claude Code plugin, not a Cowork
package or an MCP server. [Discovery checks and their limits](docs/agent-discovery.md)
document what has actually been verified.
The skill is also listed in the [Skills directory](https://skills.sh/gnawbit/demo-reel/demo-reel).
Example requests:

- "Make a README GIF showing the signup flow at http://localhost:3000."
- "Create a portrait launch demo from my web app, with captions."
- "Regenerate the product walkthrough after these UI changes."

The agent plans a story and runs the CLI. For an existing recording, supply
the video and the moments to highlight instead.

## Quickstart

```bash
# 1. Check the environment
node bin/demo-reel.mjs doctor

# 2. See it work on the bundled demo app
node bin/demo-reel.mjs demo

# 3. Use it on your own app
node bin/demo-reel.mjs plan --url https://your-app.com
node bin/demo-reel.mjs init --url https://your-app.com
```

Edit the generated `demo.json` to add your app's click/type steps, using
`plan.json` to find controls. The starter only waits on the page and will not
overwrite an existing story. Use `--out stories/demo.json` for another path.

```bash
node bin/demo-reel.mjs record --config demo.json
node bin/demo-reel.mjs render --config demo/record.json --vertical
```

Output:

```
demo/
  demo-16x9.mp4
  demo-9x16.mp4
  demo.gif
  demo-9x16.gif
  poster.png
  poster-9x16.png
  record.json
```

## The story file

```json
{
  "url": "https://your-app.com",
  "displayUrl": "your-app.com",
  "viewport": { "width": 1440, "height": 810 },
  "brand": { "background": "#070a12", "accent": "#6c5ce7" },
  "steps": [
    { "action": "wait", "ms": 600 },
    {
      "action": "click",
      "text": "New project",
      "pause": 600,
      "zoom": false,
      "caption": "Start in one click"
    },
    { "action": "wait", "ms": 900 },
    {
      "action": "type",
      "selector": "input[name=project-name]",
      "value": "Q4 Launch",
      "pause": 350,
      "caption": "Give it a name"
    },
    { "action": "wait", "ms": 900 },
    {
      "action": "click",
      "text": "Create project",
      "pause": 900,
      "zoom": false,
      "caption": "Your workspace is ready"
    }
  ]
}
```

Actions: `wait`, `goto`, `click`, `type`, `hover`, `drag`, `scroll`, `press`,
`waitFor`, `screenshot`.

Locators, in order of preference:

1. `text` — visible label
2. `role` + `name` — accessible role
3. `selector` — CSS, only when needed

Tips:

- 3–5 steps, 12–25 seconds.
- Add a short `wait` after an action so the result and caption can land.
- Use `"zoom": false` when the interesting result is elsewhere on screen.
- Captions state the benefit, not the UI label.

Captions wrap to fit the frame and shrink modestly when needed.
If a caption cannot fit at a readable size, rendering asks you to shorten it
or split it across steps. A new caption replaces the previous one immediately.

### Camera movement

Click zooms ease between targets over 0.35 seconds. Set top-level
`"zoomDuration": 0.5` in a story or marks config, or override it with
`render --config demo/record.json --zoom-duration 0.5`. Use `0` for immediate
cuts and `"zoom": false` on a step to return to the full view. Rapid clicks
continue from the current camera position.

### Posters

Posters use a frame near the end to show the result. Set `"posterAt": 4.5`
at the top level of a story or recording-marks config to choose another frame.
For an existing timeline, `render --config demo/record.json --poster-at 4.5`
overrides that setting without recording again. Times are seconds into the
trimmed output, starting at zero, and must be shorter than the video.

### Vertical branding

The 9:16 output can carry a custom hook and CTA:

```json
"vertical": {
  "badge": "Your product",
  "titleLines": ["Ship faster", "without the busywork"],
  "subtitle": "Native · Local · Private",
  "cta": "your-app.com",
  "watermark": false
}
```

`titleLines` is capped at two lines. `watermark: false` removes the small
demo-reel mark. Chinese text automatically uses a CJK font.

## Commands

| Command | What it does |
|---|---|
| `demo-reel --version` | Print the installed CLI version |
| `demo-reel capabilities --json` | List supported commands, flags and JSON support |
| `demo-reel doctor [--json]` | Check Node, Chromium, ffmpeg, fonts |
| `demo-reel setup` | Install the Chromium version used by this CLI |
| `demo-reel init --url <url>` | Create an editable story file |
| `demo-reel validate --config demo.json [--json]` | Validate a story, marks or recorded timeline without recording |
| `demo-reel plan --url <url>` | Screenshot + list interactive elements |
| `demo-reel record --config demo.json` | Record the story |
| `demo-reel render --config demo/record.json` | Render MP4 + GIF |
| `demo-reel serve` | Serve the bundled demo app |
| `demo-reel demo` | Record + render the bundled demo |

For agents, `capabilities --json` and `doctor --json` emit one JSON object on
stdout with `schemaVersion: 1` and the installed version. Diagnostic checks have
stable `id`, `required`, `status` and recovery `hint` fields on failure. Exit code
`1` means a required check failed; missing caption fonts are warnings (exit `0`
if required checks pass). Chromium is checked for installation, not launched.
JSON workflows and validation require v0.3.0 or newer.

`doctor` checks the whole toolkit. Rendering an existing recording or saved
timeline does not need Chromium. If `chromium` is the only failed required
check, skip browser setup and continue with `validate` and `render`; fix other
required errors first. Browser planning and recording still require Chromium.

Before recording, run `validate --config demo.json --json`. It checks types,
supported actions, required targets and unknown fields against the packaged
[JSON Schema](schemas/story.schema.json). Failures return exit `1` and errors
with a `code`, JSON Pointer `path` (for example `/steps/0/action`), `message` and
`hint`. Invalid JSON and unreadable files use an `error` object. Validation
does not open the browser or check selectors, login state or media files.
`record` and `render` also validate their input before changing output files.
For editor completion, add `"$schema": "https://raw.githubusercontent.com/gnawbit/demo-reel/v0.3.1/schemas/story.schema.json"`
to the config.

Useful flags:

`init`, `plan`, `record` and `render` also accept `--json`: stdout contains one
result object and progress goes to stderr. Success includes `command`, `ok`,
`version`, `schemaVersion` and an `artifacts` list with absolute paths, kinds and
byte sizes. Recording failures include a zero-based `error.step.index`, action,
JSON Pointer path and recovery hint. Fix the reported step before retrying.
Run manual `--login` in an interactive terminal without `--json`, then reuse
`--storage-state` in automation. Failed runs may leave partial files; only a
successful result's artifact list confirms the current run's outputs.

In v0.3.1 or newer, navigation failures return `PAGE_UNREACHABLE` with
URL/server/network checks, or `PAGE_HTTP_ERROR` with `error.status` for HTTP
4xx/5xx. Error pages are not recorded as successful demos. These errors omit
the target URL so credentials and query tokens are not echoed. `doctor` checks
dependencies; it cannot establish that an app is reachable.

In v0.3.1 or newer, captions start when an action finishes, before its `pause`.
Use the pause as reading time. On v0.3.0, use `pause: 0` plus a separate `wait`
step instead. Re-record to update old timelines; re-rendering preserves timing.

```bash
--login                 # open a visible browser, log in once
--storage-state auth.json
--proxy http://127.0.0.1:10808
--viewport 1440x810
--headed                # watch the recording happen
--vertical              # also render 9:16 + vertical GIF
--video recording.mp4   # render an existing recording + marks
--no-gif
--no-captions
--zoom 1.28
```

## Login and protected pages

```bash
node bin/demo-reel.mjs record --config demo.json --login
```

A visible browser opens. Log in manually in an interactive terminal. The session
is saved to `auth.json` locally and used for this recording. On later runs, or
after logging in with `plan --login`, pass it explicitly:

```bash
node bin/demo-reel.mjs record --config demo.json --storage-state auth.json
```

Use an absolute state path when changing working directories. demo-reel never
asks for your password and never uploads cookies. Keep login state out of Git.

## How it works

<img src="docs/architecture.svg" alt="Story JSON goes into Playwright recording, then a timestamped event timeline and webm go into sharp + ffmpeg, producing MP4, GIF and poster" width="100%">

1. `plan` opens the page and inventories buttons, links and inputs.
2. `record` drives Chromium, moves the cursor, clicks, types and records.
3. Click timestamps become zoom keyframes.
4. `render` crops around each click, then composes the same timeline into a
   16:9 browser canvas and a 9:16 vertical card, and encodes MP4 + GIF.

Because it drives a real browser, it works with React, Vue, Svelte, plain HTML,
SPAs and authenticated pages.

## Examples

| Example | Story | Output |
|---|---|---|
| Northstar SaaS dashboard | [examples/story.json](examples/story.json) | [16:9 MP4](docs/hero.mp4) · [9:16 MP4](docs/hero-9x16.mp4) · [GIF](docs/hero.gif) |

Northstar is a fictional bundled app. Try three [runnable recipes](examples/README.md)
for a README GIF, first-project onboarding and repeatable release assets.
Run a preset from the source checkout (or use the installed `demo-reel` command):

```bash
node bin/demo-reel.mjs demo --story readme --port 0 --out demo-readme
node bin/demo-reel.mjs demo --story onboarding --port 0 --out demo-onboarding
node bin/demo-reel.mjs demo --story release --port 0 --out demo-release
```

## Use an existing screen recording

If a site blocks automation, or you are demoing a desktop or mobile app, record
the flow with OBS, Screen Studio, QuickTime or the OS recorder, then describe
where to zoom in `marks`:

```json
{
  "displayUrl": "your-app.com",
  "video": "recording.mp4",
  "marks": [
    {
      "t": 2.1,
      "x": 0.946,
      "y": 0.048,
      "caption": "Start a new project",
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

- `t` is seconds into the recording.
- `x` and `y` are normalized `0..1`; use `zoom: false` to keep the full frame.
- `duration` is the caption hold in seconds (default `0.6`).

```bash
node bin/demo-reel.mjs render \
  --config story-video.json \
  --video recording.mp4 \
  --vertical
```

It produces the same 16:9 and 9:16 videos, GIFs and posters as a URL recording.

A minimal example lives at [examples/story-video.json](examples/story-video.json).

## Why not Screen Studio?

Different tools:

| | Screen Studio | demo-reel |
|---|---|---|
| Workflow | manual editing | a story file + one command |
| Repeatable | no | yes |
| Runs in CI | no | yes |
| Price | paid | free, MIT |

Use Screen Studio when you want frame-by-frame control. Use demo-reel when you
want a repeatable launch asset and a timeline you can commit.

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

**Do Chinese captions work?**
Yes. demo-reel picks a CJK font automatically: Microsoft YaHei on Windows,
PingFang on macOS, Noto Sans CJK on Linux. `doctor` checks it. If no CJK font is
installed, run `doctor` to see what is missing.

**Can I use the output commercially?**
Yes. The code is MIT. Make sure the page you record and the fonts/assets in it
are yours or licensed.

## Roadmap

- [x] 9:16 vertical export
- [x] Screen-recording input (`--video` + `marks`)
- [ ] Voiceover (TTS)
- [ ] Device frames (iPhone, Android, macOS)
- [ ] Brand presets
- [ ] Cloud rendering

## Contributing

Issues and PRs are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).
Please do not commit `auth.json`, customer recordings or anything that contains
personal data.

## License

MIT — see [LICENSE](LICENSE).

---

If this saved you an afternoon, a star helps more people find it.
