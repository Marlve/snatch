import { spawn } from "node:child_process";
import { parseInfo, type VideoInfo } from "./info.js";
import { track } from "./processes.js";
import { lastErrorLine } from "./stderr.js";

export type ValidationResult = { valid: true; info: VideoInfo } | { valid: false; message: string };

const TIMEOUT_MS = 30_000;

// Checks started while a link is still being typed or pasted are kept, so pressing Enter
// can reuse them instead of waiting again. Only valid results are kept for good; a failure
// (which may be a network blip) is retried.
const running = new Map<string, Promise<ValidationResult>>();
const valid = new Map<string, ValidationResult>();

export function checkLink(url: string): Promise<ValidationResult> {
  const done = valid.get(url);
  if (done) return Promise.resolve(done);
  const inFlight = running.get(url);
  if (inFlight) return inFlight;

  const check = validateLink(url).then((result) => {
    running.delete(url);
    if (result.valid) valid.set(url, result);
    return result;
  });
  running.set(url, check);
  return check;
}

export function validateLink(url: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    // "--dump-json" runs the full extraction, prints the video's details as JSON and
    // downloads nothing. "--" stops yt-dlp from reading a URL that starts with "-" as a flag.
    const child = spawn("yt-dlp", ["--dump-json", "--no-playlist", "--no-warnings", "--", url], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    track(child);

    let stdout = "";
    let stderr = "";
    let settled = false;

    function finish(result: ValidationResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    const timer = setTimeout(() => {
      child.kill();
      finish({ valid: false, message: "Checking the link timed out" });
    }, TIMEOUT_MS);

    // Decoding as a stream keeps multi-byte characters in titles intact across chunks.
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      finish({
        valid: false,
        message: err.code === "ENOENT" ? "yt-dlp was not found on your PATH" : err.message,
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        finish({ valid: false, message: lastErrorLine(stderr, "This link isn't supported") });
        return;
      }
      const info = parseInfo(stdout);
      if (!info) finish({ valid: false, message: "Couldn't read this video's details" });
      else if (!info.hasVideo && !info.hasM4a) finish({ valid: false, message: "Nothing to download: no video and no M4A audio" });
      else finish({ valid: true, info });
    });
  });
}
