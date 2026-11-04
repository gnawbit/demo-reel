import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function startServer({ port = 4173, dir = "examples/site" } = {}) {
  const root = path.resolve(ROOT, dir);

  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const filePath = path.join(root, urlPath === "/" ? "index.html" : urlPath);
      const normalized = path.normalize(filePath);

      if (!normalized.startsWith(root)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const data = await readFile(normalized);
      const ext = path.extname(normalized).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    server,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function serve(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: "string", default: "4173" },
      dir: { type: "string", default: "examples/site" },
    },
  });

  const { url } = await startServer({
    port: Number(values.port),
    dir: values.dir,
  });

  console.log(`Serving ${values.dir} at ${url}`);
  console.log("Press Ctrl+C to stop.");
}
