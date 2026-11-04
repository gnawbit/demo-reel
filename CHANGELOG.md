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
