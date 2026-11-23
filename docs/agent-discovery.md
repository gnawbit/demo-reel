# Agent discovery and invocation

Canonical source: [gnawbit/demo-reel](https://github.com/gnawbit/demo-reel).
Use the full repository identity: other projects share the `demo-reel` name,
and the unscoped npm package is unrelated.

## What is supported

- A root `SKILL.md` with a task-specific description, optional detailed
  references, and local CLI execution. This follows the
  [Agent Skills format](https://agentskills.io/specification).
- Installation through the [Skills CLI](https://github.com/vercel-labs/skills)
  and a Claude Code marketplace. CLI installation and Skill installation are
  separate; the Skill first queries the actual CLI's capabilities.
- Version-pinned Git releases for the CLI and Skill, with JSON diagnostics,
  configuration validation, execution results and artifact paths.

The project is a CLI and Skill, not an MCP server. Adding it to an MCP registry
without a working server would misdescribe its interface.

## Evidence checked on 2026-11-23

| Check | Observation |
|---|---|
| `skills@1.9.0 add gnawbit/demo-reel --list` | Discovered one Skill named `demo-reel` |
| `skills@1.9.0 find demo-reel` | Returned `gnawbit/demo-reel@demo-reel` among other projects |
| [Directory page](https://skills.sh/gnawbit/demo-reel/demo-reel) | HTTP 200, canonical source in page title |
| `claude plugin validate .` | Marketplace valid; directory checks also examine installation guidance and icon |
| `tests/agent-workflow.test.mjs` | Exercises JSON planning, initialization, recording, rendering, failures and recovery against a local fixture |

Installer checks disable telemetry. They verify discovery and installation,
not adoption. The CLI test drives commands directly; it does not measure an
LLM's spontaneous Skill selection. `evals/skill-routing.json` contains expected
labels, not measured accuracy. For actual routing results record the agent,
model, version, prompt, whether the Skill was loaded, and whether output was
successfully inspected.

## Independent Agent smoke test on 2026-11-23

Fresh delegated Agent contexts received tasks without naming demo-reel.
The [sanitized results](../evals/2026-11-23-smoke.json) preserve prompts, queries,
conditions and observed outcomes against v0.3.0:

| Condition | Observed result |
|---|---|
| Open web selection, repeatable README GIF + portrait demo | Did not find demo-reel; selected another project |
| Skills directory selection | Found demo-reel at position 40 for `README GIF` in this run; preferred another candidate |
| Skill metadata supplied with an installed CLI | Loaded the Skill, authored a story from `plan`, recorded and rendered MP4/GIF/poster |
| Same metadata, Playwright assertions only | Wrote a test without loading the Skill or invoking the CLI |
| Native Claude Code 2.1.317 plugin | Registered the Skill; authentication failed before any Skill invocation, with HTTP 401 on retry, so routing remains unmeasured |

The positive case used the fictional bundled app, not an external customer's
project. Its first render exposed delayed captions: the Agent recovered by
moving action pauses into separate waits and re-recording. The recovered
12.5-second MP4 and GIF passed frame inspection and complete decoding. This is
one controlled success and one negative control, not an accuracy percentage.
Supplying catalog metadata does not verify native client auto-discovery.

The test also exposed unhelpful navigation diagnostics while resolving local
test-environment access. `main` now distinguishes page access from dependency
failures, rejects HTTP error pages and avoids echoing URLs in navigation errors.
Caption timing was fixed separately and checked with the Agent's original story.
The v0.3.0 tag remains unchanged; these fixes are included in v0.3.1.

Public entrypoints now state the concrete inputs and outputs earlier: editable
JSON steps, local browser recording, README GIFs and portrait demos. Search and
directory indexes may lag; no ranking improvement has been measured. Re-run
fresh searches after indexing and native-client cases when model access works.

To repeat the evaluation, start a disposable local app, install the chosen tag's
CLI and Skill outside the checkout, and use fresh Agent sessions. Keep discovery
tasks unaware of the repository identity; for installed cases expose only normal
Skill metadata and the task. Record actual Skill reads/tool calls, inspect the
outputs, and separate environment failures from product failures. Keep raw logs,
machine paths and recordings local; publish only redacted results.

## v0.3.1 follow-up on 2026-11-23

The [published release](https://github.com/gnawbit/demo-reel/releases/tag/v0.3.1)
passed 42 tests and three-platform CI. Reinstallation from the public tag
verified the CLI, Codex Skill and Claude Code plugin. The CLI produced both
video layouts, GIFs and posters; animated outputs decoded successfully.
[Follow-up results](../evals/2026-11-23-v031.json) separate these installation
checks from Agent behavior:

- A fresh open-web selection Agent found demo-reel through generic queries,
  followed an external listing to the repository and selected it. The queries
  differed from the earlier run and some sources retained old installation
  guidance. This single selection establishes neither a ranking gain nor that
  the description changes caused it.
- Repeating the three Skills directory queries still placed demo-reel at 40
  for `README GIF`; the Agent selected another project. The other result sets
  did not include demo-reel, and one returned exactly 100 results.
- Native Codex CLI 0.164.0 successfully installed the tagged Skill, but the
  configured model was rejected with `model_not_found` before inference. One
  isolated retry with an explicitly selected catalog model was also rejected.
  No Skill reads or CLI calls occurred, so native routing remains unmeasured.
- A separate Agent supplied with Skill metadata used the public v0.3.1 CLI to
  turn an existing fictional recording and three marks into six artifacts.
  Initial validation and rendering succeeded. Two further renders balanced
  portrait readability against cropping; all four animated files decoded and
  sampled frames were inspected. Small app text remains a portrait limitation.
  This verifies controlled invocation, not native client routing.

The recording-only workflow also exposed an instruction gap: `doctor` checks
the whole toolkit, including Chromium, while rendering an existing video does
not use a browser. A public-tag render succeeded with no browser cache and only
the `chromium` check failing. Follow-up guidance on `main` now permits this
workflow to continue while still requiring other dependency errors to be fixed.

Next evidence should come from a working native-client model/account combination
and external projects. Search selection, directory position, internal artifact
generation and outside adoption remain separate observations.

The [official description guide](https://agentskills.io/skill-creation/optimizing-descriptions)
emphasizes relevant intent and positive/negative evaluation cases. It provides
no universal ranking multiplier or promised discovery rate. Directory presence,
correct task selection, successful execution and repeat usage are separate
measurements; this project makes no numerical ranking claims.
