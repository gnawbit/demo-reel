# Changelog

## 0.1.0 — 2026-11-04

First public version.

### Added

- `plan` — screenshot and inventory buttons, links and inputs
- `record` — Playwright recording with a fake cursor, click ripple and events
- `render` — 1080p MP4, GIF and poster with auto-zoom, captions, browser frame
  and a generated background
- 9:16 vertical export (`--vertical`) with a card frame, top label and larger
  bottom captions
- `demo` — one-command end-to-end demo on the bundled app
- `doctor` — Node, Chromium, ffmpeg, ffprobe and font checks
- Login flow via `--login` and reusable `auth.json`
- Story format: `wait`, `goto`, `click`, `type`, `hover`, `scroll`, `press`,
  `waitFor`, `screenshot`
- Agent skill instructions in `SKILL.md`
- Demo site, hero GIF/MP4 and architecture diagram

### Known limitations

- URL input only; existing screen recordings are on the roadmap
- No voiceover or music
