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
| Native Claude Code 2.1.317 plugin | Registered the Skill; model service was unreachable before any Skill invocation, so routing remains unmeasured |

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
The v0.3.0 tag remains unchanged; these fixes are on `main`.

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

The [official description guide](https://agentskills.io/skill-creation/optimizing-descriptions)
emphasizes relevant intent and positive/negative evaluation cases. It provides
no universal ranking multiplier or promised discovery rate. Directory presence,
correct task selection, successful execution and repeat usage are separate
measurements; this project makes no numerical ranking claims.
