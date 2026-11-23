import { version } from "./lib/metadata.mjs";

const HELP = `
TabRetake — turn any URL into a polished demo video and GIF.

Usage:
  tabretake setup   [--with-deps]
  tabretake --version
  tabretake capabilities [--json]
  tabretake doctor [--json]
  tabretake validate --config demo.json [--json]
  tabretake init    --url <url> [--out demo.json]
  tabretake plan    --url <url> [--out plan.json] [--login] [--storage-state auth.json]
  tabretake record  --config demo.json [--out demo] [--login] [--storage-state auth.json]
  tabretake preview --config demo.json [--headless] [--json]
  tabretake render  --config demo.json [--out demo] [--video recording.mp4] [--vertical] [--no-gif]
  tabretake serve   [--port 4173] [--dir examples/site]
  tabretake demo    [--story readme|onboarding|release] [--out demo]

Examples:
  tabretake init --url https://your-app.com
  tabretake plan --url https://your-app.com
  tabretake record --config demo.json
  tabretake render --config demo.json
  tabretake serve
  tabretake record --config examples/story.json --out demo

Options:
  --json              Machine-readable results for init, plan, record and render.
  --login             Open a visible browser so you can log in once.
  --storage-state     Reuse a saved Playwright storage state (cookies/localStorage).
  --proxy             Proxy server, e.g. http://127.0.0.1:10808
  --viewport          Viewport, e.g. 1440x810 (default from config)
  --headed            Watch the recording happen (default false)
  --vertical          Also render a 9:16 vertical video + GIF.
  --vertical-zoom     Override portrait focus zoom (1–10; otherwise uses --zoom).
  --video             Use an existing screen recording; the config needs "marks".
  --no-gif            Skip GIF export.
  --poster-at         Choose the poster time in output seconds, e.g. 4.5.
  --zoom-duration     Ease between click targets in seconds (default 0.35; 0 for cuts).
`;

export async function main(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "preview": {
      const { record } = await import("./record.mjs");
      return record(rest, "preview");
    }
    case "validate": {
      const { validate } = await import("./validate.mjs");
      return validate(rest);
    }
    case "--version":
    case "-v": {
      if (rest.length) throw new Error("--version does not accept arguments");
      console.log(version);
      return;
    }
    case "capabilities": {
      const { capabilities } = await import("./capabilities.mjs");
      return capabilities(rest);
    }
    case "setup": {
      const { setup } = await import("./setup.mjs");
      return setup(rest);
    }
    case "init": {
      const { init } = await import("./init.mjs");
      return init(rest);
    }
    case "doctor": {
      const { doctor } = await import("./doctor.mjs");
      return doctor(rest);
    }
    case "plan": {
      const { plan } = await import("./plan.mjs");
      return plan(rest);
    }
    case "record": {
      const { record } = await import("./record.mjs");
      return record(rest);
    }
    case "render": {
      const { render } = await import("./render.mjs");
      return render(rest);
    }
    case "serve": {
      const { serve } = await import("./serve.mjs");
      return serve(rest);
    }
    case "demo": {
      const { demo } = await import("./demo.mjs");
      return demo(rest);
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}
