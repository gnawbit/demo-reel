# Contributing

Thanks for helping make demo-reel better. This project is small on purpose:
a story file, a browser, a renderer.

## Development setup

```bash
git clone https://github.com/gnawbit/demo-reel
cd demo-reel
npm install
npx playwright install chromium
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
node bin/demo-reel.mjs demo
```

If you change rendering, include a before/after GIF or MP4 in the PR.

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
