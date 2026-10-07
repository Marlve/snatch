// Turns yt-dlp's output lines into progress, one line at a time.
// The downloads fill the first 90% of the bar; the final 10% is the processing
// step (FFmpeg merge or convert), which prints no percentages.
const DOWNLOAD_SHARE = 0.9;

export type ParseState = {
  streams: number;
  finished: number;
  streamPercent: number;
  percent: number;
  speed: string;
  phase: "downloading" | "processing";
};

export const INITIAL_STATE: ParseState = {
  streams: 1,
  finished: 0,
  streamPercent: 0,
  percent: 0,
  speed: "",
  phase: "downloading",
};

// "[info] abc: Downloading 1 format(s): 395+251" -> two streams to merge.
const INFO_LINE = /^\[info\] .*Downloading \d+ format\(s\): (\S+)/;

function cleanSpeed(raw: string | undefined): string {
  const speed = raw?.trim() ?? "";
  return speed === "NA" || speed.startsWith("Unknown") ? "" : speed;
}

export function parseLine(state: ParseState, line: string): ParseState {
  const info = line.match(INFO_LINE);
  if (info) return { ...state, streams: info[1].split("+").length };

  if (!line.startsWith("PROGRESS|")) return state;
  const [, status, rawPercent, rawSpeed] = line.split("|");
  const next = { ...state, speed: cleanSpeed(rawSpeed) };

  if (status === "finished") {
    next.finished += 1;
    next.streamPercent = 0;
    if (next.finished >= next.streams) next.phase = "processing";
  } else if (status === "downloading") {
    const percent = parseFloat(rawPercent);
    if (!Number.isNaN(percent)) next.streamPercent = percent / 100;
    // More streams than announced: make room for this one and leave "processing".
    if (next.finished >= next.streams) next.streams = next.finished + 1;
    next.phase = "downloading";
  }

  const overall =
    next.phase === "processing"
      ? DOWNLOAD_SHARE
      : Math.min(1, (next.finished + next.streamPercent) / next.streams) * DOWNLOAD_SHARE;
  // The bar never moves backwards.
  next.percent = Math.max(state.percent, overall);
  return next;
}
