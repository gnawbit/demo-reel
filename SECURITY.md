# Security

## Supported versions

The `main` branch is the supported version until the first tagged release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting:

https://github.com/gnawbit/demo-reel/security/advisories/new

Do not open a public issue for a vulnerability.

## What to protect

demo-reel records real pages. Treat these as sensitive:

- `auth.json` — Playwright storage state (cookies and localStorage)
- `demo/recording.webm` and generated MP4/GIF files — may contain customer data
- `demo.json` — may contain private URLs, test accounts or internal labels
- logs — may contain cookies or tokens from failing requests

Never commit any of these. The shipped `.gitignore` already ignores `auth.json`,
`demo/` and `plan.json`/`plan.png`.

## Scope

The skill is for pages you own or have explicit permission to record. It is not
intended to bypass captchas, paywalls, anti-bot systems or access controls.
