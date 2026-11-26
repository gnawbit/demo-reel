# Version Compatibility & Legacy Notes

TabRetake preserves story JSON compatibility across releases. This guide records behavioral differences for older versions so the main documentation stays focused on the current workflow.

## Package & CLI Renaming (v0.4.0+)

* **v0.4.0 and later**: Package `@gnawbit/tabretake`, CLI command `tabretake`, Agent Skill `tabretake`.
* **v0.3.3 and earlier**: Formerly published as `demo-reel`. Existing `.json` story files work unchanged with `tabretake`.

## Behavioral Changes by Release

* **v0.5.0**:
  * Added `tabretake capture` interactive recorder (outputs editable `story.json`), `tabretake run` one-command validate + record + render pipeline, and `tabretake mark` local visual video marker UI.
  * Added native `<select>` step action (`select`), HiDPI `scale: 2` / `--scale 2`, theme-matched cursor ripples, rounded content corner masks, `brand.frame` (`auto`, `browser`, `phone`, `none`), and smarter `init --auto` element scoring.
* **v0.4.2**:
  * Automatic system browser fallback (`--browser auto|chromium|chrome|msedge`) allows running `demo`, `init --auto`, `plan`, `preview`, and `record` using installed Google Chrome or Microsoft Edge when Playwright Chromium has not been downloaded via `tabretake setup`.
  * Built-in `brand.preset` / `--preset` themes (`midnight`, `daylight`, `paper`, `slate`).
  * `init --auto` (introduced on `main` after v0.4.1) is included in the published CLI.
* **v0.4.1**:
  * Landscape framing fits the source aspect ratio and places captions in a dedicated band below the content.
  * Added `vertical.zoom` / `--vertical-zoom` to magnify portrait focus points while retaining landscape overview.
* **v0.4.0**:
  * Exact button/link matching precedes partial matches, and an explicit `role` restricts matching to that role.
  * On **v0.3.3 and earlier**, a partial button label (such as `"Clear completed"`) can match `text: "Completed"` before an exact link; use a scoped CSS `selector` (such as `a[href='#/completed']`).
* **v0.3.3**:
  * `plan` adds `label` (from ARIA references / HTML labels) and native `<select>` `options` (`label`, `value`, `disabled`). Older versions omit these fields.
  * `click` waits for an enabled, unobstructed target (`timeout`, default `20000` ms) and reports `STEP_TIMEOUT`. **v0.3.2 and earlier** do not reliably wait for clickable targets.
* **v0.3.2**:
  * Portrait cards fit the source video's aspect ratio.
  * Manual `--login` navigation failures omit the target URL; HTTP 401/403 pages remain open for sign-in.
* **v0.3.1**:
  * Captions start when an action finishes (before its `pause`). On **v0.3.0**, set `pause: 0` followed by a separate `wait` step. Re-record older stories to adopt corrected caption timing.
  * Navigation failures return `PAGE_UNREACHABLE` or `PAGE_HTTP_ERROR` instead of generic `COMMAND_FAILED`.
* **v0.3.0**:
  * Introduced `--json` output, `validate`, and `capabilities --json`. On **v0.2.0**, fall back to `help` and plain `doctor`, or upgrade before running automated Agent workflows.
