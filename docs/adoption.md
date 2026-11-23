# Trial feedback and weekly review

The three published recipes are maintainer reproductions. External adoption is
not yet established. The CLI has no usage telemetry.

## First trial

Use the published npm release and a local app with disposable data. Choose a
short flow with one visible result. Record the version, environment, first
obstacle, whether the output was usable, and whether a later retake succeeded.
The [TodoMVC recipe](https://gnawbit.github.io/tabretake/todomvc/) is a starting
point; a trial on the user's own app gives stronger evidence.

Submit a [first-demo report](https://github.com/gnawbit/tabretake/issues/new?template=first-demo.yml).
Public links are optional. Never request login state or private recordings.
Keep installation success, usable output, repeat use and adoption separate.

## Invitation draft — not sent

For a developer who already wants a repeatable Web demo; send only after the
owner approves a named recipient and channel. Upstream recipe projects have
not endorsed TabRetake. Do not open promotional bug reports in their trackers.

> 我在维护 TabRetake，一个本地生成 Web 演示视频和 README GIF 的 CLI，也可通过
> AI 编程助手使用。你如果近期需要展示一个 Web 功能，可以试着在自己的测试环境
> 跑一条短流程。最想了解的是首次卡在哪一步、成片是否可用，以及改动后能否重拍。
> 项目：https://github.com/gnawbit/tabretake 。无需提供私有数据或录屏；失败反馈同样有用。

## Weekly snapshot

Run once a week from the checkout, using a new filename:

```sh
node tools/collect-metrics.mjs --traffic --out evals/weekly/YYYY-MM-DD.json
```

`--traffic` reads an existing GitHub credential (or GITHUB_TOKEN) for repository
traffic. Without it, only public stars/forks are collected. No credentials or
individual visitor identities are written. Existing snapshots are not overwritten.
Review the data before committing; fill external usage only from reviewed reports.
This command does not schedule itself or send invitations.

| Measure | Evidence and interpretation |
|---|---|
| Stars | GitHub snapshot; compare with the previous snapshot |
| Repository views and referrers | GitHub rolling 14-day window, UTC; not website analytics |
| First success | Distinct external reporters who confirm usable output; exclude maintainer tests |
| Repeat use | The same reporter confirms a successful later retake after a change |
| Adoption | A public integration or explicit confirmation that the project uses the workflow beyond a trial |

GitHub traffic can lag capture time; retain returned dates. Do not add overlapping
14-day totals or daily unique counts. Clones include automated/maintainer activity
and do not measure adoption. Unknown usage is null, not zero. No conversion rate
is meaningful without a known denominator. See [GitHub traffic documentation](https://docs.github.com/en/rest/metrics/traffic).

Each review should name the strongest observed obstacle, one next change, and
the evidence needed to judge it. The initial baseline prioritizes external trial
feedback; additional maintainer demos cannot establish external adoption.
