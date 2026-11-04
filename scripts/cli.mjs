const HELP = `
demo-reel — turn any URL into a polished demo video and GIF.

Usage:
  demo-reel doctor
  demo-reel plan    --url <url> [--out plan.json] [--login] [--storage-state auth.json]
  demo-reel record  --config demo.json [--out demo] [--login] [--storage-state auth.json]
  demo-reel render  --config demo.json [--out demo] [--vertical] [--no-gif]
  demo-reel serve   [--port 4173] [--dir examples/site]
  demo-reel demo    [--out demo]

Examples:
  demo-reel plan --url https://your-app.com
  demo-reel record --config demo.json
  demo-reel render --config demo.json
  demo-reel serve
  demo-reel record --config examples/story.json --out demo

Options:
  --login             Open a visible browser so you can log in once.
  --storage-state     Reuse a saved Playwright storage state (cookies/localStorage).
  --proxy             Proxy server, e.g. http://127.0.0.1:10808
  --viewport          Viewport, e.g. 1440x810 (default from config)
  --headed            Watch the recording happen (default false)
  --vertical          Also render a 9:16 vertical video + GIF.
  --no-gif            Skip GIF export.
`;

export async function main(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "doctor": {
      const { doctor } = await import("./doctor.mjs");
      return doctor();
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
