import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Selection } from "../options/formats.js";
import { buildArgs } from "./args.js";
import { INITIAL_STATE, parseLine } from "./parse.js";
import { track } from "./processes.js";
import { lastErrorLine } from "./stderr.js";
import type { DownloadUpdate } from "./types.js";

export const OUTPUT_DIR = join(homedir(), "Downloads");

// Starts yt-dlp and calls onUpdate each time the progress changes. The last
// update has phase "done" or "failed".
export function startDownload(
  url: string,
  selection: Selection,
  onUpdate: (update: DownloadUpdate) => void,
  outDir: string = OUTPUT_DIR,
): void {
  const child = spawn("yt-dlp", [...buildArgs(selection, outDir), "--", url], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  track(child);

  let state = INITIAL_STATE;
  let stderr = "";
  let ended = false;

  function fail(error: string): void {
    if (ended) return;
    ended = true;
    onUpdate({ phase: "failed", percent: state.percent, speed: "", error });
  }

  // "data" chunks can end mid-line; readline hands us whole lines.
  createInterface({ input: child.stdout }).on("line", (line) => {
    const next = parseLine(state, line);
    if (next === state) return;
    state = next;
    onUpdate({ phase: state.phase, percent: state.percent, speed: state.speed });
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  child.on("error", (err: NodeJS.ErrnoException) => {
    fail(err.code === "ENOENT" ? "yt-dlp was not found on your PATH" : err.message);
  });

  child.on("close", (code) => {
    if (code === 0) {
      if (ended) return;
      ended = true;
      onUpdate({ phase: "done", percent: 1, speed: "" });
    } else {
      fail(lastErrorLine(stderr, `yt-dlp exited with code ${code}`));
    }
  });
}
