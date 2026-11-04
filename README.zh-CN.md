# demo-reel

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
[![Version](https://img.shields.io/badge/version-0.1.0-6c5ce7)](package.json)
[![Agent skill](https://img.shields.io/badge/agent%20skill-Claude%20Code%20%7C%20Codex%20%7C%20Cursor-6c5ce7)](SKILL.md)

**给它一个网址，拿回一条能发出去的产品演示视频和 GIF。**

<img src="docs/hero.gif" alt="demo-reel 自动录屏、点击放大、加字幕" width="100%">

[看 12 秒 MP4](docs/hero.mp4) · [安装](#安装) · [工作原理](#工作原理) · [路线图](#路线图)

demo-reel 是一个 agent skill：它用真实浏览器打开你的产品，像人一样点击，
自动放大每次点击、加光标、字幕、浏览器边框和背景，最后渲染成 MP4 + GIF。

不用手动剪辑，不用买录屏软件，一条命令。

> 支持 Claude Code、Codex、Cursor，以及任何支持
> [Agent Skills](https://agentskills.io) 的 agent。

---

## 为什么做这个

每个产品发布都需要一条演示：

- README 顶部的一张 GIF
- 官网 hero 区的一段视频
- 发 X、小红书、Product Hunt 的短片
- 新用户引导里的操作演示

手动录一条要 1–3 小时，而且看起来像“随手录的”。demo-reel 把它变成可重复的命令：
UI 改了，重跑一遍，就是新的 demo。

**你会得到**

- 1080p MP4 + GIF + 封面
- 每次点击自动放大
- 光标和点击波纹
- 讲收益、不讲按钮名字的字幕
- 浏览器边框和生成的背景
- 可重渲染的 `record.json` 时间线
- 全部在本机完成，不上传、不联网渲染

## 安装

作为 agent skill：

```bash
npx skills add yanjiangfan/demo-reel
```

从源码：

```bash
git clone https://github.com/yanjiangfan/demo-reel
cd demo-reel
npm install
npx playwright install chromium
node bin/demo-reel.mjs doctor
```

要求：Node 20+。ffmpeg/ffprobe 由 npm 包提供，不需要系统安装。

## 快速开始

```bash
# 1. 检查环境
node bin/demo-reel.mjs doctor

# 2. 跑一遍内置 demo
node bin/demo-reel.mjs demo

# 3. 录你自己的产品
node bin/demo-reel.mjs plan --url https://your-app.com
node bin/demo-reel.mjs record --config demo.json
node bin/demo-reel.mjs render --config demo/record.json
```

输出：

```
demo/
  demo-16x9.mp4
  demo.gif
  poster.png
  record.json
```

## 故事文件

```json
{
  "url": "https://your-app.com",
  "displayUrl": "your-app.com",
  "viewport": { "width": 1440, "height": 810 },
  "brand": { "background": "#070a12", "accent": "#6c5ce7" },
  "steps": [
    { "action": "wait", "ms": 600 },
    {
      "action": "click",
      "text": "New project",
      "pause": 600,
      "zoom": false,
      "caption": "一键开始"
    },
    { "action": "wait", "ms": 900 },
    {
      "action": "type",
      "selector": "input[name=project-name]",
      "value": "Q4 Launch",
      "pause": 350,
      "caption": "起个名字"
    },
    { "action": "wait", "ms": 900 },
    {
      "action": "click",
      "text": "Create project",
      "pause": 900,
      "zoom": false,
      "caption": "工作区已就绪"
    }
  ]
}
```

动作：`wait`、`goto`、`click`、`type`、`hover`、`scroll`、`press`、`waitFor`、`screenshot`。

定位元素优先级：

1. `text`：可见文字
2. `role` + `name`：无障碍角色
3. `selector`：CSS，最后才用

技巧：

- 3–5 步，12–25 秒。
- 每个动作后加一小段 `wait`，让结果和字幕落地。
- 如果结果在屏幕别处，用 `"zoom": false` 拉回全景。
- 字幕讲收益，不讲“点击按钮”。

## 命令

| 命令 | 作用 |
|---|---|
| `demo-reel doctor` | 检查 Node、Chromium、ffmpeg、字体 |
| `demo-reel plan --url <url>` | 截图 + 列出可交互元素 |
| `demo-reel record --config demo.json` | 录制故事 |
| `demo-reel render --config demo/record.json` | 渲染 MP4 + GIF |
| `demo-reel serve` | 启动内置 demo 站点 |
| `demo-reel demo` | 录制 + 渲染内置 demo |

常用参数：

```bash
--login                 # 打开有头浏览器，手动登录一次
--storage-state auth.json
--proxy http://127.0.0.1:10808
--viewport 1440x810
--headed                # 看着它录
--no-gif
--no-captions
--zoom 1.28
```

## 登录和受保护页面

```bash
node bin/demo-reel.mjs record --config demo.json --login
```

会打开一个有头浏览器，你手动登录，登录态保存在本地 `auth.json`，后续复用。
demo-reel 不会向你要密码，也不会上传 cookie。

## 工作原理

<img src="docs/architecture.svg" alt="故事文件进入 Playwright 录制，生成事件时间线和 webm，再由 sharp + ffmpeg 渲染成 MP4、GIF 和封面" width="100%">

1. `plan` 打开页面，列出按钮、链接和输入框。
2. `record` 驱动 Chromium，移动光标、点击、输入、录屏。
3. 点击时间戳变成缩放关键帧。
4. `render` 裁出点击区域、加字幕、浏览器边框和背景，再用 ffmpeg 编码。

因为驱动的是真实浏览器，React、Vue、Svelte、纯 HTML、SPA 和登录后的页面都能录。

## 示例

| 示例 | 故事 | 输出 |
|---|---|---|
| Northstar SaaS dashboard | [examples/story.json](examples/story.json) | [MP4](docs/hero.mp4) · [GIF](docs/hero.gif) |

## 录不了的站点

有些站点有验证码、强反爬、或纯 Canvas 界面。这种情况下，先手动录屏，
再把录屏作为输入（直接视频输入在路线图上）。不要尝试绕过验证码或反爬。

## 和 Screen Studio 的区别

| | Screen Studio | demo-reel |
|---|---|---|
| 工作流 | 手动剪辑 | 故事文件 + 一条命令 |
| 可重复 | 否 | 是 |
| 能进 CI | 否 | 是 |
| 价格 | 付费 | 免费，MIT |

要逐帧精修，用 Screen Studio；要可重复、可提交、可自动化的发布素材，用 demo-reel。

## 常见问题

**这是录屏软件吗？**
不是。它是“故事文件 + 浏览器 + 渲染器”的可重复流水线，录屏只是副产物。

**Windows 能用吗？**
能。项目就在 Windows 上开发，ffmpeg 用 npm 包自带二进制。

**必须用 AI agent 吗？**
不必。CLI 可以独立使用；agent skill 只是让它自动读页面、写故事、跑命令。

**能录别人的网站吗？**
只在获得授权时。不要用它抓取、绕过付费墙或规避反爬。

**输出可以商用吗？**
可以。代码是 MIT。确保你录的页面、字体和素材是你自己的或已授权。

## 路线图

- [ ] 9:16 竖屏导出
- [ ] 已有录屏输入（自动缩放 + 字幕）
- [ ] 配音（TTS）
- [ ] 设备边框（iPhone、Android、macOS）
- [ ] 多套品牌预设
- [ ] 云端渲染

## 参与贡献

欢迎 issue 和 PR，先看 [CONTRIBUTING.md](CONTRIBUTING.md)。
请不要提交 `auth.json`、客户录屏或任何包含个人数据的文件。

## License

MIT — 见 [LICENSE](LICENSE)。

---

如果它帮你省下了一个下午，点个 star 能让更多人看到。
