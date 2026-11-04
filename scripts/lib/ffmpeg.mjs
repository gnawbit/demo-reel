import { spawn } from "node:child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

export const FFMPEG = ffmpegInstaller.path;
export const FFPROBE = ffprobeInstaller.path;

export function run(bin, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      windowsHide: true,
      stdio: ["ignore", capture ? "pipe" : "inherit", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(
        new Error(
          `${bin} exited with code ${code}\n${stderr.slice(-4000) || stdout.slice(-4000)}`,
        ),
      );
    });
  });
}

export function ffmpeg(args) {
  return run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    capture: true,
  });
}

export async function probe(file) {
  const { stdout } = await run(
    FFPROBE,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    { capture: true },
  );
  return JSON.parse(stdout);
}

export async function duration(file) {
  const info = await probe(file);
  return Number(info.format?.duration || 0);
}

export async function videoSize(file) {
  const info = await probe(file);
  const stream = (info.streams || []).find((s) => s.codec_type === "video");
  return {
    width: Number(stream?.width || 0),
    height: Number(stream?.height || 0),
    duration: Number(info.format?.duration || 0),
  };
}
