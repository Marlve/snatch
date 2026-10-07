import { join } from "node:path";
import type { Selection } from "../options/formats.js";

// Makes yt-dlp print "PROGRESS|status|percent|speed" on its own line for each update.
const PROGRESS_TEMPLATE =
  "download:PROGRESS|%(progress.status)s|%(progress._percent_str)s|%(progress._speed_str)s";

// "1080p" -> best video up to 1080 lines tall plus best audio, or else the best
// single combined file. "Best available" has no height limit.
function videoSelector(quality: string | null): string {
  const height = quality?.match(/^(\d+)p$/)?.[1];
  return height ? `bv*[height<=${height}]+ba/b[height<=${height}]` : "bv*+ba/b";
}

// Highest resolution first; among equal resolutions prefer H.264 video and AAC audio.
const VIDEO_SORT = "res,vcodec:h264,acodec:m4a";

export function buildArgs(selection: Selection, outDir: string): string[] {
  const { format, quality, filename } = selection;
  const base = [
    "--newline",
    "--no-playlist",
    "--no-warnings",
    "--progress-template",
    PROGRESS_TEMPLATE,
    "-o",
    // "%" starts a yt-dlp template field, so a literal one in the name is doubled.
    join(outDir, `${filename.replaceAll("%", "%%")}.%(ext)s`),
  ];

  switch (format.id) {
    // The site's own m4a stream, saved as is with no conversion.
    case "m4a":
      return [...base, "-f", "ba[ext=m4a]"];
    default:
      return [...base, "-f", videoSelector(quality), "-S", VIDEO_SORT, "--merge-output-format", format.id];
  }
}
