# Changelog

## Unreleased

- Prefer exact button/link labels before partial controls and plain text, and keep explicit roles scoped, so a “Completed” link is not mistaken for a “Clear completed” button.

## 0.3.3 — 2026-11-23

- Wait for click targets to become actionable and report blocked clicks as step timeouts instead of successful recordings.
- Include form labels and native select options in page plans so Agents can identify controls without guessing from field values.

## 0.3.2 — 2026-11-23

- Redact target URLs from manual login navigation failures while keeping HTTP 401/403 pages available for sign-in.
- Fit portrait cards to the source aspect ratio so mobile and ultrawide recordings retain their edges at overview zoom.
- Clarify rendering prerequisites and platform-neutral publishing examples; correct native Agent evaluation failure evidence.

## 0.3.1 — 2026-11-23

- Start captions before action pauses so the pause provides reading time. Re-record older stories to adopt the corrected timestamps.
- Distinguish unreachable pages from HTTP errors, preserve failed navigation step locations and avoid echoing target URLs in these errors.
- Clarify public discovery and installation entrypoints; record independent Agent smoke tests with their limitations.

## 0.3.0 — 2026-11-23

- Shorten the Skill entrypoint with focused references; add client metadata, a plugin icon and verified installation guidance.
- Add JSON results and artifact manifests for init, plan, record and render; report failed recording steps and require interactive manual login.
- Upgrade Sharp to 0.35.5 for patched image libraries; require Node.js 20.9 or newer.
- Validate stories, marks and recorded timelines before execution; add a packaged JSON Schema and field-level JSON diagnostics.
- Add machine-readable diagnostics, version and capability queries; keep diagnostics usable when dependencies are missing.
- Wrap captions within the frame, prevent overlaps and preserve recording brightness under decorative frames.
- Ease click zooms and pans without cutting the timeline; configure timing with `zoomDuration` or `--zoom-duration`.
- Select poster frames with `posterAt` or `--poster-at`; default to a frame near the end and support short clips.
- Add runnable README GIF, onboarding and release demo recipes with `demo --story`.

## 0.2.0 — 2026-11-20

- Package the CLI as `@gnawbit/demo-reel` with an explicit runtime file list.
- Add `setup` and support running the installed demo outside the source checkout.
- Add `init --url` to create an editable story without overwriting existing files.
- Improve skill task matching, input/output guidance and installation instructions.
- Exclude password field values from page plans and logs.
- Scroll targets into view before browser interactions and use the demo server's actual port.
- Validate packaged installation, recording and rendering on Linux, Windows and macOS.

## 0.1.0 — 2026-11-04

First public version.

### Added

- `plan` — screenshot and inventory buttons, links and inputs
- `record` — Playwright recording with a fake cursor, click ripple and events
- `render` — 1080p MP4, GIF and poster with auto-zoom, captions, browser frame
  and a generated background
- 9:16 vertical export (`--vertical`) with a card frame, top label and larger
  bottom captions
- Configurable vertical badge, title lines, subtitle and CTA
- Captions stay on screen until the next caption for easier reading
- Screen-recording input (`--video` + normalized `marks`) for sites that block
  automation and for desktop/mobile apps
- `drag` steps for sliders, carousels and comparison handles
- Automatic CJK font selection for Chinese captions
- Page-load pre-roll is trimmed from the final video
- `demo` — one-command end-to-end demo on the bundled app
- `doctor` — Node, Chromium, ffmpeg, ffprobe and font checks
- Login flow via `--login` and reusable `auth.json`
- Story format: `wait`, `goto`, `click`, `type`, `hover`, `scroll`, `press`,
  `waitFor`, `screenshot`
- Agent skill instructions in `SKILL.md`
- Demo site, hero GIF/MP4 and architecture diagram

### Known limitations

- Screen-recording marks are manual; automatic click detection is not included
- No voiceover or music
