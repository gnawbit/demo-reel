# TabRetake 全渠道推广与种子用户获取操作手册 (Distribution Playbook)

本手册用于支持 TabRetake（当前版本 **v0.5.0**）的社区发布、技术写作与开发者试用收集。遵循客观、实测、尊重开源社区规范的原则，不夸大效果、不向无关项目仓库 Issue 投放推广，以真实可运行的命令行与案例成片获取初期反馈和外部采用。

---

## 目录

1. [渠道矩阵与当前推进状态](#一渠道矩阵与当前推进状态)
2. [国内核心开发者社区发布文案](#二国内核心开发者社区发布文案)
   - [V2EX（分享创造 / 程序员）](#1-v2ex分享创造--程序员)
   - [阮一峰《科技爱好者周刊》投稿（已更新同步至 v0.5.0）](#2-阮一峰科技爱好者周刊投稿)
   - [HelloGitHub 开源月刊推荐投稿（已更新同步至 v0.5.0）](#3-hellogithub-开源月刊推荐投稿)
3. [海外顶级技术生态发布文案](#三海外顶级技术生态发布文案)
   - [Show HN (Hacker News)](#1-show-hn-hacker-news)
   - [Twitter / X 发布 Thread](#2-twitter--x-发布-thread)
   - [Reddit (r/webdev, r/opensource)](#3-reddit-rwebdev-ropensource)
4. [技术复盘长文草稿（掘金 / 知乎 / Dev.to）](#四技术复盘长文草稿掘金--知乎--devto)
   - [中文长文草稿（掘金 / 知乎）](#1-中文长文草稿掘金--知乎)
   - [英文长文草稿：Dev.to / Hashnode](#2-英文长文草稿devto--hashnode)
5. [真实开源项目定向邀请与协作规范](#五真实开源项目定向邀请与协作规范)
   - [联系原则（严禁在 Issue 提推广垃圾）](#1-联系原则严禁在-issue-提推广垃圾)
   - [为 Vikunja 维护者准备的分享草稿](#2-vikunja-定向分享草稿)
   - [为 Memos 维护者准备的分享草稿](#3-memos-定向分享草稿)
6. [转化指标追踪与自检清单](#六转化指标追踪与自检清单)

---

## 一、渠道矩阵与当前推进状态

| 阶段 / 渠道 | 目标受众 | 核心入口与呈现形式 | 当前状态 |
|---|---|---|---|
| **仓库检索与技能目录**<br>GitHub Topics / `skills.sh` | GitHub 站内搜索与 Agent Skills CLI 用户 | 13 个高召回 Topics；`skills.sh` 新名页面 `gnawbit/tabretake/tabretake` | 已完成标签补全与目录页激活（Algolia 全文检索按服务端同步节奏生效） |
| **开源月刊 / 精选清单**<br>阮一峰周刊 / HelloGitHub / Awesome 清单 | 国内中文开源读者、Playwright 与 Claude Code 生态用户 | 真实案例成片展示 + 一键可复现 CLI / Skill | 周刊 `#13728`、HelloGitHub `#4487`、`awesome-playwright#319`、`awesome-llm-skills#359`、`awesome-claude-skills#2504` 已开启 |
| **中文开发者主阵地**<br>V2EX / 掘金 / 知乎 | Web 全栈、前端与 AI 编程助手高频用户 | 痛点对比 + `capture` / `mark` / `run` 30 秒上手 + 真实案例 GIF | **待发布（文稿已按 v0.5.0 就绪，需账号登录后发布）** |
| **海外技术主阵地**<br>Show HN / Twitter(X) / Reddit / Dev.to | 独立开发者、OSS 维护者、Cursor/Claude Code 用户 | `Show HN` 技术工程解析 + 4 推文 Thread + 英文深度复盘 | **待发布（文稿已按 v0.5.0 就绪，需账号登录后发布）** |
| **外部试用闭环**<br>定向邀请 & `first-demo.yml` | 有真实发版演示需求的 Web 开发者 | 试用模板反馈首次障碍、成片可用性与二次重拍效果 | **待授权发送（见 [docs/adoption.md](adoption.md)）** |

---

## 二、国内核心开发者社区发布文案

### 1. V2EX（分享创造 / 程序员）

- **建议节点**：`分享创造`（主推）或 `程序员`
- **标题**：`受够了每次界面改版都要重新录屏剪辑？做了一个支持浏览器直录和本地重拍的开源 Web 演示生成器 TabRetake`
- **正文草稿**：

```markdown
各位 V 友大家好，

写开源项目 README 或发新版本的时候，几乎都要配一条产品演示 GIF 或竖屏宣传视频。但传统的录屏剪辑工作流一直很折腾：
1. **界面一微调就全作废**：改了个按钮文案或边距，之前的录屏和剪辑节奏全得重录重剪；
2. **竖屏 9:16 根本看不清字**：把桌面网页塞进手机竖屏后，核心结果区域小到糊成一团；
3. **字幕经常挡住关键按钮**：浮在画面上的字幕很容易遮住输入框和 CTA；
4. **必须手写脚本也很劝退**：如果只是为了录一个 15 秒演示，还要手写一套完整定位脚本，心智负担依然高。

为此我开源了一个完全运行在本地、基于 **Playwright + FFmpeg + Sharp** 的命令行工具与 AI Agent Skill：**TabRetake（v0.5.0）**。

- GitHub：https://github.com/gnawbit/tabretake
- 协议：MIT（100% 本地运行，零云端上传、无遥测）

### v0.5.0 提供了三条低门槛工作流，不用全靠手写

1. **浏览器交互直录成故事（`tabretake capture`）**：
   直接打开浏览器让你像平时一样点击、输入、下拉选择并锁定结果元素位置，退出时自动导出可编辑的 JSON 故事文件（自动跳过密码字段，支持 `--run` 直接顺手出片）。
2. **已有视频本地打点工作台（`tabretake mark`）**：
   如果目标页面有反爬或者你在录桌面/移动端录屏，也可以直接用本地可视化面板在已有 MP4/WebM 上点几下标记时间戳和焦点坐标，复用同一套渲染排版。
3. **AI Agent 接管 + 一条命令重拍闭环（`init --auto` / `run`）**：
   安装 Agent Skill 或 Claude Code 插件后，直接告诉 Claude Code / Codex / Cursor 你要演示哪个 URL 和核心流程；工具会自动扫描页面控件、跳过导航死链和危险操作、生成带平滑点击缩放、主题匹配光标波纹和居底不遮挡字幕的成片，并保存 `record.json` 时间线——后续只改文案、主题（`midnight` / `daylight` / `paper` / `slate`）或封面帧（`posterAt`），执行 `tabretake render` 几秒就能重渲染，无需再开浏览器。

### 核心出片能力
- **16:9 README GIF / 1080p MP4**：按源视频比例自适应留白，字幕固定放在内容区下方，绝不遮挡交互元素；
- **9:16 竖屏短视频 & GIF**：支持独立局部缩放倍率（`--vertical-zoom`）与轻量手机框样式（`brand.frame: "phone"`）；
- **2x HiDPI 缩放清晰度**：支持 `--scale 2`，放大点击局部时文字依然锐利。

### 拒绝假数据：真实开源项目实测成片
所有演示均跑在未修改的真实上游开源版本上（项目页有完整可复现配方 https://gnawbit.github.io/tabretake/ ）：
- **Vikunja v2.8.0 (15k★ 看板)**：创建任务 -> 切换看板 -> 跨列拖入 Doing -> 自动聚焦结果卡片（成片 16:9 GIF 约 425 KB）：
  https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/hero.gif
- **Memos 26.11.2 (35k★ 知识笔记)**：`contenteditable` 富文本写入、保存、搜索过滤与结果聚焦（成片 GIF 约 837 KB）：
  https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/examples/memos.gif
- **TodoMVC（ES6 标准示例）**：新增、勾选与多状态筛选完整演示（成片 GIF 约 908 KB）。

### 30 秒本地直接试跑（复用本机 Chrome / Edge，无需等下载浏览器）
```bash
npm install --global @gnawbit/tabretake@0.5.0
tabretake demo --preset daylight
```
想录自己的网站，直接运行交互捕获：
```bash
tabretake capture --url http://localhost:3000 --out demo.json --run --vertical --scale 2
```
Claude Code 用户也可以直接安装插件或 Skill：
```bash
claude plugin install tabretake --marketplace "gnawbit/tabretake#v0.5.0"
# 或通用 Agent Skills CLI：
npx skills@1.9.0 add "https://github.com/gnawbit/tabretake.git#v0.5.0" --skill tabretake
```

项目刚升级到 **v0.5.0**，非常希望听听大家在制作项目 README 动图、发版短片或对接 AI Coding Agent 时的真实痛点与建议。如果刚好帮到你，欢迎顺手点个 Star 支持一下，也欢迎用仓库里的反馈模板提真实试跑反馈！
```

---

### 2. 阮一峰《科技爱好者周刊》投稿

- **投稿地址**：在 [ruanyf/weekly](https://github.com/ruanyf/weekly/issues) 提交 Issue（当前已更新同步在 `ruanyf/weekly#13728`）。
- **Issue 标题**：`开源项目推荐：TabRetake —— 可重复生成的 Web 应用演示与 README 动图生成器`
- **Issue 内容参考稿（v0.5.0 同步版）**：

```markdown
## 项目名称
TabRetake

## 项目地址
https://github.com/gnawbit/tabretake

## 项目简介
每个 Web 项目发版或写 README 都需要演示动图与视频，但手动录屏不仅耗时，一旦界面微调就必须全部重录。

TabRetake (v0.5.0) 是一个 100% 本地运行、基于 Playwright 与 FFmpeg 的声明式 Web 演示生成器（同时提供 CLI、Agent Skill 与 Claude Code 插件）。开发者既可以通过 `tabretake capture` 在浏览器真实点选一次自动生成可编辑的 JSON 故事，也可以用 `tabretake init --auto` 扫描页面控件或通过 `tabretake mark` 为已有录屏可视化打点，一键执行 `tabretake run` 生成带点击缓动放大、光标波纹与居底不遮挡字幕的 16:9 README GIF/MP4 及 9:16 竖屏发布短片。界面微调后只需更新配置重新运行，文案、主题预设或封面时间点改动甚至可以直接基于 `record.json` 秒级重渲染。

## 核心亮点
1. **三栖零门槛输入**：支持浏览器交互直录（`capture`）、DOM 智能扫描（`init --auto`）与本地已有视频可视化打点（`mark`）；
2. **默认复用本地浏览器 + HiDPI 支持**：找不到独立 Chromium 时自动回退到本机 Chrome/Edge（`--browser auto`），支持 `--scale 2` 与四套亮暗预设主题（`midnight`/`daylight`/`paper`/`slate`）；
3. **真项目端到端验证**：已在未改动的 Vikunja（看板跨列拖拽，16:9 GIF 约 425 KB）、Memos（富文本与检索，约 837 KB）和 TodoMVC（约 908 KB）上完成全流程复现；
4. **完全本地运行**：基于 Node.js 20.9+、Playwright、FFmpeg 与 Sharp，MIT 协议，零云端上传。

## 演示动图
![TabRetake Vikunja 演示](https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/hero.gif)
```

---

### 3. HelloGitHub 开源月刊推荐投稿

- **投稿地址**：在 [521xueweihan/HelloGitHub](https://github.com/521xueweihan/HelloGitHub/issues) 提交 Issue（当前已更新同步在 `521xueweihan/HelloGitHub#4487`）。
- **Issue 内容参考稿（v0.5.0 同步版）**：

```markdown
- 项目名称：TabRetake
- 项目地址：https://github.com/gnawbit/tabretake
- 类别：JavaScript / 开发者工具
- 一句话描述：支持浏览器交互捕获与视频打点的可重复 Web 演示视频及 README GIF 生成器
- 项目推荐语：
每次 Web 产品改版都要重新录屏剪辑 README 动图？TabRetake（v0.5.0）把产品演示变成了可编辑、可一键重拍的本地工作流。支持三种零负担上手方式：打开浏览器点一遍直接导出 JSON 故事（`capture`）、智能扫描页面表单控件生成脚本（`init --auto`）、或导入现有录屏在本地打点面板标注缩放焦点（`mark`）。随后执行 `tabretake run` 即可本地同步渲染带平滑点击放大、光标波纹和居底不遮挡字幕的 16:9 README GIF/MP4 与 9:16 手机竖屏短片，支持 `--scale 2` HiDPI 与本地 Chrome/Edge 自动复用。项目基于 Playwright、Sharp 和 FFmpeg 运行，完全离线、MIT 开源，真实复杂应用 9 秒看板演示动图约 425 KB。
- 效果展示：
https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/hero.gif
```

---

## 三、海外顶级技术生态发布文案

### 1. Show HN (Hacker News)

- **标题**：`Show HN: TabRetake – Repeatable README GIFs and 9:16 demo videos via Playwright`
- **链接**：`https://github.com/gnawbit/tabretake`
- **正文（无冗余寒暄、工程逻辑直切要害）**：

```markdown
Hi HN,

I built TabRetake because recording launch clips and README GIFs manually breaks down the moment a UI changes—you tweak one button label or CSS margin, and the entire recording + zoom keyframe edit is obsolete.

TabRetake (v0.5.0, MIT) turns Web UI flows into reproducible 16:9 README GIFs/MP4s, 9:16 portrait videos, and PNG posters—running 100% locally via Playwright Chromium (or your existing Chrome/Edge), Sharp, and FFmpeg.

Instead of forcing you to hand-write a story file from scratch, v0.5.0 gives you three ways to start:
1. Interactive capture (`tabretake capture`): click, type, select, and pin result `focus` targets in a real browser window to generate an editable `story.json` (passwords are automatically omitted; add `--run` to render immediately).
2. Auto-scan (`tabretake init --auto`): scores main forms/CTAs/selects while skipping empty nav links and destructive buttons to bootstrap a runnable story.
3. Local visual marker studio (`tabretake mark --video recording.mp4`): for desktop apps or automation-blocked pages, click directly on frames of an existing MP4/WebM recording to pick timestamps and zoom coordinates.

What happens under the hood:
- `record` captures the browser flow with `--scale 2` HiDPI support and outputs a `record.json` timeline alongside raw video.
- `render` crops and eases camera pans over click/focus keyframes, renders theme-matched cursor ripples (`midnight`, `daylight`, `paper`, `slate`), fits the content by aspect ratio, and places wrapped captions in a dedicated bottom band so text never covers buttons.
- Changing copy, theme presets, poster timestamp (`--poster-at`), or portrait magnification (`--vertical-zoom`) only re-runs FFmpeg on `record.json`—no browser launch required.

Tested on unmodified upstream builds (full recipes at https://gnawbit.github.io/tabretake/):
- Vikunja v2.8.0 (Kanban card creation + drag into Doing + result focus -> 425 KB GIF): https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/hero.gif
- Memos 26.11.2 (contenteditable rich-text authoring + search focus -> 837 KB GIF)
- TodoMVC ES6 (live task filtering + manual GitHub Actions workflow, 908 KB GIF)

Try it locally in ~30 seconds (automatically falls back to installed Chrome/Edge via `--browser auto`):
```bash
npm install --global @gnawbit/tabretake@0.5.0
tabretake demo --preset daylight
```

Works directly from the CLI or as an Agent Skill / Claude Code plugin (`SKILL.md` at repo root). Repo: https://github.com/gnawbit/tabretake

Curious how other devs here handle keeping README GIFs and vertical release videos in sync with fast-moving UIs—and whether `capture` vs `mark` matches your real workflow.
```

---

### 2. Twitter / X 发布 Thread

- **Tweet 1（主推文 + 附带 `docs/hero.mp4` 或 `docs/hero.gif`）**：
  > Stop re-recording and re-editing your product demo every time a UI label changes.
  >
  > Meet TabRetake v0.5.0: an open-source, 100% local Playwright + FFmpeg CLI & Agent Skill that turns real browser clicks or existing recordings into 16:9 README GIFs & 9:16 launch videos.
  >
  > No hand-editing keyframes. 👇 1/4

- **Tweet 2（三种零摩擦入口）**：
  > 3 ways to create a repeatable demo in v0.5.0:
  >
  > • `tabretake capture` -> Click through your app once -> exports an editable JSON story (skips passwords)
  > • `tabretake init --auto` -> Scans forms/CTAs into steps
  > • `tabretake mark` -> Visual point-and-click studio for existing MP4/WebM videos
  >
  > Run `tabretake run --vertical --scale 2` for HiDPI 16:9 + 9:16 outputs. 2/4

- **Tweet 3（排版细节 + 真实开源实测，可配 `docs/poster-9x16.png` 对比图）**：
  > Built to avoid common demo headaches:
  > • Dedicated bottom caption band -> never covers buttons
  > • `--vertical-zoom` -> readable desktop UI on 9:16 mobile
  > • `record.json` timeline -> switch `--preset daylight/midnight/paper/slate` without re-recording
  >
  > Verified on real OSS apps: Vikunja (Kanban drag, 425 KB GIF), Memos (837 KB), TodoMVC. 3/4

- **Tweet 4（安装 CTA + 零下载浏览器兜底）**：
  > Already have Chrome or Edge installed? Run the demo immediately with zero extra browser download (`--browser auto`):
  >
  > `npm i -g @gnawbit/tabretake@0.5.0`
  > `tabretake demo --preset daylight`
  >
  > Works with Claude Code, Codex, and Cursor. MIT licensed.
  > Repo: https://github.com/gnawbit/tabretake 4/4

---

### 3. Reddit (`r/webdev`, `r/opensource`)

> [!IMPORTANT]
> 在 `r/webdev` 发布请留意 **Showoff Saturday** 版规与自我推广比例要求；`r/opensource` 强调开源协议、完全离线无暗坑以及实际技术栈透明披露，避免广告腔调。

- **建议社区**：`r/webdev`（Showoff Saturday）或 `r/opensource`
- **标题**：`I built TabRetake (MIT) – a local Playwright + FFmpeg CLI to turn live browser flows or screen recordings into repeatable 16:9 README GIFs & 9:16 demo videos`
- **正文草稿**：

```markdown
I got tired of re-recording and hand-zooming screen captures every time our frontend UI changed slightly right before a release, so I built **TabRetake** (just hit **v0.5.0**, MIT licensed).

**GitHub:** https://github.com/gnawbit/tabretake
**Live examples (Vikunja Kanban, Memos, TodoMVC):** https://gnawbit.github.io/tabretake/

### What makes it different from Screen Studio / manual video editors?
Instead of baking edits into a one-off project timeline you have to redo after every UI change, TabRetake decouples **what happens** (`story.json` / `marks`) from **how it looks** (`record.json` + presets):

- **`tabretake capture`**: Opens your local browser; click, type, select, and pin focus targets manually and it saves a clean `story.json` (automatically omitting password values). Pass `--run` to render on exit.
- **`tabretake init --auto`**: Inspects interactive DOM controls (prioritizing main forms/CTAs while skipping empty nav links/destructive actions) to scaffold a story.
- **`tabretake mark`**: Already have an MP4/WebM from OBS or an OS recorder? Open a local point-and-click studio to drop zoom coordinates and captions on the timeline—handy for desktop apps or sites that block automation.
- **`tabretake run --vertical --scale 2`**: Validates, captures HiDPI 2x frames, eases click zooms, draws theme-matched click ripples, and encodes 16:9 MP4/GIF + 9:16 portrait video/GIF + PNG posters in one command.
- **Re-render without re-recording**: Want to switch from `midnight` to `daylight`, `paper`, or `slate` preset, adjust `--poster-at`, or tweak caption text? Run `tabretake render --config demo/record.json --preset daylight` against the cached timeline in seconds.

### No-wait quick check
If Chrome or Edge is already installed on your machine, `--browser auto` uses it automatically without waiting for a fresh Playwright Chromium download:

```bash
npm install --global @gnawbit/tabretake@0.5.0
tabretake demo --preset daylight
```

### Real-world checks (not synthetic AI templates)
- **Vikunja v2.8.0 (15k★ Kanban):** creating a card, switching to Kanban view, dragging across columns into *Doing*, and focusing the moved card -> 425 KB README GIF ([gif](https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/hero.gif)).
- **Memos 26.11.2 (35k★):** `contenteditable` note authoring + tag search focus -> 837 KB GIF.
- **TodoMVC ES6:** task filter walkthrough + manual GitHub Actions workflow artifact generation.

Everything executes locally on Node.js 20.9+ (Playwright, Sharp, FFmpeg)—no cloud service, no accounts, no telemetry. Also ships with a root `SKILL.md` for Claude Code, Codex, and Cursor workflows.

Would love technical feedback on the story schema, portrait `--vertical-zoom` cropping tradeoffs, or any rough edges on your OS!
```

---

## 四、技术复盘长文草稿（掘金 / 知乎 / Dev.to）

> 以下两篇分别为中文技术社区（掘金 / 知乎）与英文技术社区（Dev.to / Hashnode）准备，侧重可信的工程原理拆解与真实踩坑过程，而非单纯软广。

### 1. 中文长文草稿（掘金 / 知乎）

- **标题备选**：
  - `从手动录屏剪辑到「可重拍」：基于 Playwright + FFmpeg 打造本地 Web 演示视频生成器的工程实践`
  - `改一行按钮文案就得重录宣传片？我用 Playwright + FFmpeg 写了一个可重拍演示生成器`
- **正文草稿**：

```markdown
做 Web 开源项目或者 SaaS 功能迭代时，我们几乎都会遇到同一个低效环节：每次发版前用录屏软件录一条演示视频，手动推拉镜头放大点击位置、加上居底字幕、导出 16:9 README GIF，再额外裁一份 9:16 竖屏发社区。

只要测试提一句「这个按钮文案改一下」或者「边距调宽 8px」，整套录屏、缩放关键帧和剪辑时间线就得从头再来。

为了把「软件演示视频」变成像代码测试一样可版本化、可重复执行的资产，我做了 **TabRetake**（MIT 协议，目前已发布 **v0.5.0**）。这篇文章不空谈概念，主要复盘我们在真实项目复现（Vikunja 看板拖拽、Memos 富文本笔记、TodoMVC）和架构演进中解决的几个核心工程问题。

---

## 一、为什么不直接用 Playwright 自带的 `recordVideo`？

Playwright 原生就有录制功能，但直接用来做产品演示会立刻碰到四个问题：

1. **没有视觉焦点和交互反馈**：原生录屏只是平铺直叙的屏幕画面，看不出鼠标去了哪里、什么时候发生了点击，缩成 README 小图后几乎找不到关键动作；
2. **字幕时机与遮挡矛盾**：直接把文字叠加在浏览器底部往往挡住状态栏或弹窗；而把动作和字幕硬编码进单条视频流里，后期一旦要改文案或配色，就必须重跑整个浏览器；
3. **16:9 与 9:16 的视角冲突**：桌面 1440×810 的操作画面如果原样塞进 1080×1920 竖屏卡片里，细字小得不可读；但如果全局暴力裁剪，又会切掉页面边缘标题和上下文；
4. **精确控件匹配的隐患**：如果只是给 AI 或脚本传一个 `"text": "Completed"`，很容易误命中页面先出现的 `"Clear completed"`。

---

## 二、核心三段式解耦架构

在 TabRetake 中，我们将「**做什么操作**」和「**如何渲染镜头与画面**」彻底拆开，中间用一份标准化的 `record.json` 时间线连接：

```text
输入层（3 种零负担入口）
  ├─ tabretake capture        -> 真实浏览器点一遍导出 story.json（跳过密码）
  ├─ tabretake init --auto    -> 智能启发式扫描页面主表单 / CTA / select
  └─ tabretake mark --video   -> 导入已有 MP4/WebM 在本地可视化打点生成 marks
          │
          ▼
录制层（Playwright + HiDPI 2x）
  └─ 驱动步骤 / 严格匹配器 / 注入光标轨迹、点击波纹、拖拽偏移与时间戳 -> raw.webm + record.json
          │
          ▼
合成层（Sharp + FFmpeg filter_complex）
  ├─ 16:9 桌面工作区画布：按源比例适配 + 独立底部字幕区 + 结果封面 poster.png
  └─ 9:16 竖屏卡片画布：独立 --vertical-zoom 放大倍率 + 轻量手机框 + 竖屏 GIF/MP4
```

这个设计最实用的收益在于**「二次编辑零重录」**：当你发现字幕需要精简、主题色想从暗黑 `midnight` 换成浅色 `daylight`、或者封面截取时间（`--poster-at`）不够理想时，只需针对 `record.json` 重跑 `tabretake render`，几秒钟内由 FFmpeg 直接重新合成，完全不必重启浏览器。

---

## 三、开发过程中踩过的几个关键工程坑

### 1. 字幕不遮挡交互与“先出现还是后出现”
早期版本中，我们在点击之后才展示字幕，结果鼠标停顿时间全花在操作前，用户还没读完字画面就切走了；同时居中叠加文字挡住了按钮。
最终调整为两个硬性约束：
- **字幕时序前移**：在动作完成后立刻显示对应收益型文案，并利用步骤 `pause` 作为自然阅读停顿窗口；
- **布局分区**：不再覆盖视频画面本身，而是在 16:9 和 9:16 帧内均预留出**专属居底字幕带（Bottom Caption Band）**，视频按原始宽高比等比缩放进入上方内容区，配合自动字号折行保证中文字体不重叠、不截断、不遮挡 UI。

### 2. 控件匹配精度：为什么 “Completed” 会误点成 “Clear completed”
在针对 TodoMVC 的真实复现测试中，一步点击 `text: "Completed"` 的指令意外点中了按钮 `"Clear completed"`——因为旧匹配器混用了模糊文本顺序。
在后续修正中我们重构了定位优先级：**显式 CSS `selector` > 显式 `role` 限定作用域 > 精确文本的 Button / Link > 局部匹配的 Button / Link > 纯文本降级**。同时在页面采集阶段，将 ARIA 标签、HTML `label` 和原生 `<select>` 选项一并写入 `plan.json`，避免给脚本或 AI 留下歧义。

### 3. 竖屏 9:16 可读性与 `2x HiDPI` 缩放
桌面录制如果按 1x 分辨率直接放大 1.5~1.8 倍放进竖屏，边缘字体会发虚。
我们在 `v0.5.0` 加入两项配合能力：
- 录制端支持 `--scale 2`（HiDPI 2 倍设备像素比捕获）；
- 渲染端拆开横竖屏缩放参数，允许在保持 `16:9` 全景浏览（`--zoom 1`）的同时，单独用 `--vertical-zoom 1.8` 让竖屏镜头精准推近局部卡片（如 Vikunja 看板拖入 Doing 后的结果卡片）。
同时我们在代码层面诚实承认了权衡边界：竖屏高倍放大会自然裁切外围背景，全景小窗下的桌面极细文字依然受物理分辨率限制，需要靠最后一步显式 `focus` 镜头把结果卡片拉近。

### 4. 让工具真正“降门槛”的浏览器与录制方案（v0.4.2 -> v0.5.0）
早期跑 CLI 必须先执行 `tabretake setup` 下载整套 pinned Chromium，首次体验等待过长。因此我们实现了：
- **`--browser auto` 回退探测**：本机只要已有 Chrome 或 Edge 即可直接开跑（`tabretake demo` 零等待）；
- **`tabretake capture`**：对于不想写 JSON 的开发者，直接开窗真实操作一遍，监听点击、输入、下拉与“钉住焦点目标（focus）”，自动输出干净的 `story.json`；
- **`tabretake mark`**：对于桌面应用、Electron 或强制反自动化网站，启动一个零依赖的本地 HTTP 视频打点页，直接在时间轴画面上点几下生成标准化 `(t, x, y)` 坐标文件。

---

## 四、真实开源项目实测而非 AI 假图

为了验证方案不是只能跑通自定义静态页，我们在三个公开的外部项目上做了端到端真实录制与视频完整解码检验：

1. **Vikunja v2.8.0（15k★ 开源看板）**：登录隔离环境 -> 创建任务 -> 切看板 -> 跨列拖入 *Doing* -> 结果 `focus` 聚焦。16:9 README GIF 体积压到了 **425 KB**。
2. **Memos 26.11.2（35k★ 知识笔记）**：针对 `contenteditable` 富文本输入框写入内容、保存、搜索过滤并拉近焦点（GIF 约 **837 KB**）。
3. **TodoMVC（ES6 基准）**：新增、完成、筛选任务，并在 GitHub Actions 中做成可手动触发、自动产物的基准验证工作流（GIF 约 **908 KB**）。

*(注：以上三个案例均由维护者在本机按固定上游版本配置复现并公开 recipe，不作为上游背书或外部采用统计。)*

---

## 五、快速体验与源码地址

如果你正在维护开源项目或 SaaS 工具，欢迎在本地试跑一下内置示例：

```bash
npm install --global @gnawbit/tabretake@0.5.0
tabretake demo --preset daylight
```

或者直接针对你自己的开发环境生成一份交互式故事并出片：

```bash
tabretake capture --url http://localhost:3000 --out demo.json --run --vertical --scale 2
```

- **GitHub 仓库（MIT）**：https://github.com/gnawbit/tabretake
- **项目示例与配方页**：https://gnawbit.github.io/tabretake/

项目还提供了标准 `SKILL.md`（支持 Claude Code / Codex / Cursor），也提供 [首次演示反馈模板](https://github.com/gnawbit/tabretake/issues/new?template=first-demo.yml)。欢迎一起交流更流畅的软件演示自动化工作流！
```

---

### 2. 英文长文草稿：Dev.to / Hashnode

- **标题**：`Making Web App Demo Videos Declarative and Reproducible with Playwright + FFmpeg (TabRetake v0.5.0)`
- **标签**：`#opensource` `#playwright` `#webdev` `#ffmpeg`
- **正文草稿**：

```markdown
Every developer knows the release-day tax: you finish shipping a feature, manually screen-record a walkthrough, spend 30–60 minutes nudging zoom keyframes and subtitles in a video editor, export a GIF for your README—and then notice one button label or CSS margin changed before launch. Everything has to be recorded all over again.

I built **TabRetake** (MIT licensed, [gnawbit/tabretake](https://github.com/gnawbit/tabretake), **v0.5.0**) so Web product demos behave like repeatable build artifacts: editable, local-only, and re-runnable in seconds.

---

## Decoupling "Actions" from "Camera & Framing"

Instead of mixing browser interactions and visual effects into a one-off project file, TabRetake splits the pipeline into three clean stages joined by `record.json`:

1. **Input / Authoring (3 friction-free routes in v0.5.0)**:
   - `tabretake capture`: Perform the flow once in a live browser window—clicks, inputs, `<select>` changes, and pinned result `focus` targets export straight to `story.json` (passwords omitted).
   - `tabretake init --auto`: Scans the DOM for main forms and CTAs while filtering out dead nav links or destructive buttons.
   - `tabretake mark --video clip.mp4`: A local point-and-click studio for turning existing OBS/desktop recordings into normalized `(t, x, y)` mark files when sites block automation.
2. **Capture (`record`)**:
   - Drives Chromium (or local Chrome/Edge via `--browser auto`), waits for actionable targets instead of blind sleeps, optionally records at `--scale 2` HiDPI, and records exact event timestamps into `record.json`.
3. **Render (`render`)**:
   - Feeds raw frames + `record.json` into **Sharp** + **FFmpeg** to produce 16:9 landscape MP4/GIF, 9:16 vertical MP4/GIF, and PNG poster images simultaneously.
   - Because `record.json` stores the raw interaction timeline, switching theme presets (`midnight`, `daylight`, `paper`, `slate`), updating caption wording, changing `--poster-at`, or tuning `--vertical-zoom` runs **without opening a browser again**.

---

## Real Engineering Tradeoffs Solved Along the Way

### Keeping Captions Readable Without Hiding UI Controls
Overlaying subtitles inside the web viewport inevitably hides buttons or toasts. We changed both 16:9 and 9:16 compositing to fit the recorded viewport proportionally inside the main area while reserving a **dedicated bottom caption band**. Wrapped text shrinks gracefully when needed and fails fast with clear guidance if a sentence is too long to remain legible.

### Preventing Ambiguous Selector Matches
While testing real open-source apps like TodoMVC, a naive locator for `"Completed"` matched `"Clear completed"` first because substring checks ran alongside exact role matching. Our matcher now prioritizes: scoped CSS `selector` -> explicit `role` -> exact button/link -> partial button/link -> plain text fallback, while `plan` exposes ARIA/HTML labels and `<select>` options directly.

### Portrait Legibility (`9:16`) vs Context Cropping
Shrinking a 1440×810 desktop flow onto a 9:16 screen makes tiny UI labels illegible. Combining `--scale 2` recording with independent `--zoom` vs `--vertical-zoom` (e.g. `1.0` landscape overview + `1.8` portrait zoom + an explicit final `focus` step on the result card) makes mobile clips readable while explicitly trading away outer margins during tight zooms.

---

## Real-World Tests (Not Synthetic Mockups)

Rather than relying on synthetic marketing demos, every release recipe on our [project page](https://gnawbit.github.io/tabretake/) is tested end-to-end against pinned unmodified upstream apps:

- **Vikunja v2.8.0 (15k★ Kanban):** Create task -> switch board -> drag card across columns into *Doing* -> focus result card (**425 KB** 16:9 GIF).
- **Memos 26.11.2 (35k★ Notes):** Author inside a `contenteditable` rich-text box -> save -> filter by search -> focus (**837 KB** GIF).
- **TodoMVC ES6:** Full task lifecycle + manual GitHub Actions workflow artifact generation (**908 KB** GIF).

---

## Try It Locally in 30 Seconds

If Chrome or Edge is already installed, you don't even have to wait for a pinned Chromium download:

```bash
npm install --global @gnawbit/tabretake@0.5.0
tabretake demo --preset daylight
```

Capture your own local dev server interactively:

```bash
tabretake capture --url http://localhost:3000 --out demo.json --run --vertical --scale 2
```

Ships with a root `SKILL.md` for Claude Code, Codex, and Cursor (`npx skills@1.9.0 add "https://github.com/gnawbit/tabretake.git#v0.5.0" --skill tabretake`). Everything runs locally—zero cloud uploads, zero telemetry, MIT licensed.

Repo & issues: https://github.com/gnawbit/tabretake
```

---

## 五、真实开源项目定向邀请与协作规范

### 1. 联系原则（严禁在 Issue 提推广垃圾）

> [!CAUTION]
> **开源礼仪第一准则**
> - **绝对禁止**在目标开源项目的 GitHub Issue 或 Discussions 发布任何未被邀请的营销推广；
> - 仅通过 **Twitter/X 私信**、**开源项目公开 Discord/Slack 社区的 `#showcase` 频道**，或在对方主动寻找 README 动图方案时提供帮助（且向外发送具体对象与渠道前须经维护者确认）；
> - 核心出发点是：**“免费顺手做了这条轻量、可一键重跑的演示素材，如果对项目文档有帮助可以直接拿走使用”**。

---

### 2. Vikunja 定向分享草稿

- **联系渠道**：Vikunja 官方论坛 / Discord `#general` 或 Twitter 提及 `@go_vikunja`
- **英文草稿**：

```text
Hi @go_vikunja team! Huge fan of Vikunja.

I noticed many users love seeing the Kanban workflow in action before installing. I used our open-source tool (TabRetake) to record a reproducible 9-second walkthrough of creating a task and dragging it across the Vikunja Kanban board:

- 16:9 GIF (~425 KB): https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/hero.gif
- 9:16 Mobile Short: https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/hero-9x16.mp4
- Reproducible story JSON: https://github.com/gnawbit/tabretake/blob/main/site/vikunja/story.json

Feel free to use the GIF/video directly in your README or docs if you find it helpful—no attribution required. If you ever want timing or captions adjusted for a new release, happy to re-run it anytime!
```

---

### 3. Memos 定向分享草稿

- **联系渠道**：Memos Discord `#showcase` 或公开社区讨论群
- **英文草稿**：

```text
Hey @usememos contributors!

We love Memos' clean UI and speed. To showcase how snappy rich-text authoring and instant search are, we generated a repeatable, lightweight demo clip using your official v26.11.2 release:

- Lightweight GIF (~837 KB): https://raw.githubusercontent.com/gnawbit/tabretake/main/docs/examples/memos.gif
- Reproducible story file: https://github.com/gnawbit/tabretake/blob/main/site/memos/story.json

You're completely welcome to drop the GIF into your README or release notes if you'd like a live preview of Memos in action. Thanks for building such a great project!
```

---

## 六、转化指标追踪与自检清单

每次社区发布或定向分享后，手动运行仓库指标采集脚本留档（不设自动调度、不外泄凭据）：

```bash
node tools/collect-metrics.mjs --traffic --out evals/weekly/YYYY-MM-DD.json
```

指标解读口径遵循 [docs/adoption.md](adoption.md)：
- **来源观察**：核查 `referrers` 中是否开始出现 `v2ex.com`、`news.ycombinator.com`、`reddit.com`、`t.co` 或 `juejin.cn` / `dev.to`；
- **区分漏斗阶段**：把安装成功（npm 下载 / 首次跑通）、首次有效出片反馈（[first-demo.yml](https://github.com/gnawbit/tabretake/issues/new?template=first-demo.yml)）、二次改动重拍与外部公开采用分开记录，未知项记为 `null`，不凭浏览量推算虚高转化率；
- **外部背书沉淀**：一旦收到真实外部开发者试用成功案例或有外部仓库主动采纳生成的动图，再补充记录进证据文档中。
