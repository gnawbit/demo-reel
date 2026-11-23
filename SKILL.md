---
name: demo-reel
description: Create repeatable product demo videos and README GIFs from a web app URL or an existing screen recording. Use when asked for a launch video, browser walkthrough, signup or onboarding demo, or to regenerate a demo after UI changes, including 产品演示、网页录屏、README 动图. Runs locally and exports MP4, GIF and posters in landscape or portrait. Requires a story script or recording marks. Not for general video editing, text-to-video generation, or browser test assertions.
license: MIT
metadata:
  author: gnawbit
  version: "0.3.3"
  repository: https://github.com/gnawbit/demo-reel
  compatibility: Node.js 20.9+, Chromium via demo-reel setup, Windows/macOS/Linux. Target app access is required. Rendering is local; dependency installation needs network access.
---

# demo-reel by gnawbit

Create a repeatable product walkthrough from a web URL, or render an existing
screen recording with supplied timestamps. The canonical project is
https://github.com/gnawbit/demo-reel; similarly named packages are unrelated.
Outputs are local MP4, GIF and PNG posters in landscape and optional portrait.

## Locate and check the CLI

Use an installed `demo-reel` CLI when available. The commands below assume it is
on PATH. For a source checkout, replace `demo-reel` with
`node /absolute/path/to/demo-reel/bin/demo-reel.mjs`; paths with spaces need quoting.
A copied Skill does not prove its runtime dependencies are installed. If needed,
clone the canonical repository separately and run `npm ci` there, or follow its
version-pinned README installation. Do not install the unrelated npm package
`demo-reel`.

```bash
demo-reel --version
demo-reel capabilities --json
demo-reel doctor --json
```

Query capabilities before choosing flags: old releases may not support them.
On v0.2.0, fall back to `help` and plain `doctor`, or update before using the
JSON workflow. `doctor` reports required errors and optional font warnings;
it checks Chromium's presence, not browser launch or app access. For web
planning/recording, run `demo-reel setup` for missing Chromium; Linux may need
`setup --with-deps`. Rendering an existing recording or saved timeline does not
need Chromium: if `chromium` is the only failed required check, continue to
validate/render without installing a browser. Fix other required errors first.
Node.js 20.9+ is required. Chinese captions need a CJK system font.

## Choose the input

- **Web app:** confirm the URL and intended flow. `plan` inventories controls;
  it does not write a story. Use a test account and non-sensitive demo data.
- **Existing recording:** get the file and moments to highlight. Read
  [recording input and branding](references/rendering.md); do not invent marks.
- **Example requested:** `demo-reel demo --story readme|onboarding|release --port 0`
  runs a fictional bundled app. It is a template, not evidence of external adoption.

Ask only for missing details that affect the result, such as the target flow or
output orientation. Adapt the story length to the user's request; a few visible
state changes are usually enough for a short launch clip.

## Record a web flow

1. Inspect controls and create a starter if no story exists:

   ```bash
   demo-reel plan --url https://your-app.com --out plan.json --json
   demo-reel init --url https://your-app.com --out demo.json --json
   ```

2. Read the plan file from its returned artifact path. Replace the starter's
   wait-only steps with the requested flow. For actions, locator choices and
   timing units, read [story authoring](references/story.md). `init` will not
   overwrite a story. Prefer a visible result at the end and short benefit captions.
   From v0.3.3, use `label` to identify form controls and native select `options`
   to inspect their labels, values and disabled states. Older versions omit these
   fields; use the plan screenshot and existing control metadata instead.
   The plan's `name` is an HTML attribute, not necessarily an accessible name;
   use `selector` when needed.

3. Validate, record and render:

   ```bash
   demo-reel validate --config demo.json --json
   demo-reel record --config demo.json --out demo --json
   demo-reel render --config demo/record.json --vertical --json
   ```

   Omit `--vertical` for landscape only; add `--no-gif` if GIFs are unnecessary.
   Use the returned timeline path if output goes elsewhere. Paths are resolved
   from the current working directory unless documented otherwise; use absolute
   paths when the CLI and target app live in different directories.

   From v0.3.2, portrait cards fit the source aspect ratio. For a mobile flow,
   inspect and record at a narrow viewport (for example `390x844`); use
   `--zoom 1` to preserve the full viewport. Wide desktop text may still be small.

4. Inspect the poster and video, then return links to the actual generated
   artifacts. Re-record after flow changes; re-render the saved timeline after
   caption, zoom or branding changes. Fonts and encoder versions can affect
   appearance across machines. Output videos have no audio.

For caption reading time, use action `pause` on v0.3.1 or newer; on v0.3.0
use `pause: 0` followed by `wait`. Older recordings need to be recorded again
to adopt the corrected caption timing; re-rendering preserves their timestamps.

## Interpret results and recover

`--json` writes one object to stdout; stderr carries progress. Check the exit
code and `ok`, then read `artifacts` for absolute paths, kinds and byte sizes.
Only a successful result describes the current run; failed runs may leave
partial files. `schemaVersion` identifies the response format, not the CLI release.

- `INVALID_CONFIG`: fix each `error.issues[].path` using the packaged
  [JSON Schema](schemas/story.schema.json). The standalone `validate` command
  returns an `errors` array for schema failures and an `error` object for file
  or JSON syntax failures. It does not verify selectors, login or media access.
- `TARGET_NOT_FOUND`, `STEP_TIMEOUT`, `STEP_FAILED`: inspect `error.step.path`
  and its zero-based index. Re-run `plan` with the same login state, update the
  target or wait condition and retry. Do not repeat an unchanged failing command.
  From v0.3.3, `click` also waits for an enabled, unobstructed
  target using step `timeout` (milliseconds; default 20,000). v0.3.2 and earlier
  do not reliably wait for clickable targets; inspect the resulting page.
- `PAGE_UNREACHABLE`: check the URL, local app server and browser network/proxy
  access. `PAGE_HTTP_ERROR`: inspect `error.status`; fix the route/server or use
  authorized login state for 401/403. These codes are available in v0.3.1 or newer;
  older versions may return `COMMAND_FAILED`. Dependency checks do not prove
  page access, and an HTTP error page is not a completed demo.
- Missing runtime or fonts: inspect `doctor --json` and its recovery hints.
- Captcha, anti-bot block, iframe-only or canvas-only flow: use a user-provided
  recording with marks instead of trying to bypass the restriction.

## Protected pages and privacy

Manual login needs an interactive terminal without `--json`:

From v0.3.2, login navigation errors also omit the target URL. HTTP 401/403
pages stay open for sign-in; other HTTP errors stop the command.

```bash
demo-reel plan --url https://your-app.com --login
demo-reel record --config demo.json --storage-state auth.json --json
```

`auth.json` is created in the login command's working directory and is never
implicitly loaded by later commands. Use an absolute state path after changing
directories. If it expires, let the user log in again; do not request passwords
or 2FA codes in chat. Do not upload or commit login state or private recordings.
Stories and recorded timelines retain typed values, so use synthetic data.
Record only authorized pages; the workflow does not authorize publishing assets.
