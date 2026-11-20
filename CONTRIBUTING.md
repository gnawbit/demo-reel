# Contributing

Thanks for helping make demo-reel better. This project is small on purpose:
a story file, a browser, a renderer.

## Development setup

```bash
git clone https://github.com/gnawbit/demo-reel
cd demo-reel
npm install
node bin/demo-reel.mjs setup
node bin/demo-reel.mjs doctor
```

## Run the demo

```bash
node bin/demo-reel.mjs demo
```

This starts the bundled app, records `examples/story.json`, and renders
`demo/demo-16x9.mp4`, `demo.gif` and `poster.png`.

## Code style

- Node 20+, ESM, plain JavaScript. No build step.
- Keep the CLI dependency-light.
- Prefer small modules in `scripts/lib/`.
- Do not add a framework for a 200-line feature.
- Keep user-facing copy in English in code, with Chinese in the READMEs.

## Testing before a PR

```bash
node --check bin/demo-reel.mjs
for f in scripts/*.mjs scripts/lib/*.mjs; do node --check "$f"; done
node bin/demo-reel.mjs doctor
npm test
```

The tests cover password redaction, browser actions inside and outside the
viewport, and a complete demo recording on an automatically assigned port.
The demo test packs and installs the CLI into a temporary consumer project,
runs browser setup, and records from outside the source checkout. Use
`npm test` so the test can locate the active npm CLI; installation requires
access to the configured npm registry.
They check both video formats, decode the MP4s, and inspect the animated GIFs
and posters. Test outputs are created in temporary directories and removed
afterward. CI runs these checks on Linux, Windows and macOS with Node 20.

If you change rendering, include a before/after GIF or MP4 in the PR.

For skill description changes, use `evals/skill-routing.json` with the skill
installed in the target agent. Record whether it loads `SKILL.md` for each
request, plus the agent version and date. The labels are intended behavior,
not measured results; metadata validation alone does not establish routing
accuracy or directory ranking.

## Pull requests

- One focused change per PR.
- Explain the user-facing problem, not just the implementation.
- Update `README.md`, `README.zh-CN.md` and `SKILL.md` if you add a config
  field or command.
- Do not commit `auth.json`, customer recordings, cookies or API keys.

## Reporting bugs

Open an issue with the bug template. Redact URLs, cookies and customer data
from logs and configs.

## Security

If you find a vulnerability, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.
