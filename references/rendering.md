# Recording input and rendering

For a site that cannot be automated, or a desktop/mobile demonstration, use an
existing screen recording. Obtain timestamps from the user or inspect the video;
do not silently guess the moments to highlight.

Rendering uses FFmpeg, ffprobe and Sharp; it does not launch Chromium. A missing
browser in `doctor --json` alone does not block this workflow. Other required
checks still apply, and missing fonts need visual inspection of captions.

```json
{
  "displayUrl": "your-app.com",
  "video": "recording.mp4",
  "marks": [
    { "t": 2.1, "x": 0.5, "y": 0.4, "duration": 0, "caption": "Start a project" },
    { "t": 4.8, "zoom": false, "caption": "Ready for the team" }
  ]
}
```

```bash
tabretake validate --config story-video.json --json
tabretake render --config story-video.json --video recording.mp4 --vertical --json
```

`video` in the config is relative to the config file; `--video` is relative to
the current working directory. Marks use **seconds**. Prefer normalized `x`, `y`
coordinates from 0 to 1; larger values are source pixels. `duration` delays the
caption onset after the mark (default 0.6 seconds); `0` shows it immediately.
It does not set the caption's display duration. Captions last up to 2.8 seconds,
ending earlier at the next caption or video end.

Rendering a recorded browser flow takes its `record.json` timeline instead.
For style edits, update that file's nested `config`; changing only the original
story will not update a saved timeline. Re-record for changed browser actions.

## Camera, posters and portrait branding

- `--zoom 1.28` sets focus magnification.
- `zoomDuration` or `--zoom-duration 0.5` sets transition seconds; `0` uses cuts.
- `posterAt` or `--poster-at 4.5` selects an output time strictly before the end.
  Without it, the poster is chosen near the end.
- `--vertical` adds portrait outputs; `--no-gif` skips GIFs; `--no-captions`
  suppresses captions and font-based portrait text.

Portrait cards fit the source video's aspect ratio between the title and captions.
For a responsive mobile UI, record with a narrow viewport such as `390x844`;
inspect the page with `plan --viewport 390x844` before recording at that size.
Use `--zoom 1` to retain the full viewport. Larger zoom values intentionally crop
around each focus point. A wide desktop recording still has small text in a
portrait card; re-record a focused flow at a suitable viewport when needed.

Branding belongs at the top of a story/marks config, or inside a timeline's `config`:

```json
{
  "brand": { "background": "#070a12", "accent": "#6c5ce7" },
  "vertical": {
    "badge": "Your product",
    "titleLines": ["Ship faster", "with less busywork"],
    "subtitle": "Local and repeatable",
    "cta": "your-app.com",
    "watermark": false
  }
}
```

Use at most two title lines. Captions wrap and fit within the frame; excessively
long captions produce an error. Chinese text needs a CJK font such as Microsoft
YaHei, PingFang or Noto Sans CJK. Font warnings do not stop rendering, so inspect
the poster and video for missing glyphs. Videos have no audio track.
