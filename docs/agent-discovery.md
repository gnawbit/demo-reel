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

The [official description guide](https://agentskills.io/skill-creation/optimizing-descriptions)
emphasizes relevant intent and positive/negative evaluation cases. It provides
no universal ranking multiplier or promised discovery rate. Directory presence,
correct task selection, successful execution and repeat usage are separate
measurements; this project makes no numerical ranking claims.
