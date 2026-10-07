import type { Stream, VideoInfo } from "../downloader/info.js";
import type { Format } from "./formats.js";

const bytesOf = (s: Stream, duration: number | null): number | null => {
  if (s.size !== null) return s.size;
  return s.tbr !== null && duration !== null ? Math.round(((s.tbr * 1000) / 8) * duration) : null;
};

const desc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1);

// Mirrors yt-dlp's pick (-S res,vcodec:h264,acodec:m4a, then the larger stream).
function bestVideo(streams: Stream[], maxHeight: number): Stream | undefined {
  return streams
    .filter((s) => s.hasVideo && (s.height ?? 0) <= maxHeight)
    .sort(
      (a, b) =>
        desc(a.height, b.height) ||
        Number(b.vcodec.startsWith("avc")) - Number(a.vcodec.startsWith("avc")) ||
        desc(a.size, b.size) ||
        desc(a.tbr, b.tbr),
    )[0];
}

function bestAudio(streams: Stream[], nativeM4aOnly: boolean): Stream | undefined {
  return streams
    .filter((s) => s.hasAudio && !s.hasVideo && (!nativeM4aOnly || s.ext === "m4a"))
    .sort(
      (a, b) =>
        Number(b.acodec.startsWith("mp4a")) - Number(a.acodec.startsWith("mp4a")) ||
        desc(a.size, b.size) ||
        desc(a.tbr, b.tbr),
    )[0];
}

// Rough size of the finished file in bytes, or null when the site gives too little to tell.
export function estimateBytes(info: VideoInfo, format: Format, quality: string | null): number | null {
  const { streams, duration } = info;
  if (format.id === "m4a") {
    const audio = bestAudio(streams, true);
    return audio ? bytesOf(audio, duration) : null;
  }

  const height = Number.parseInt(quality ?? "", 10);
  const video = bestVideo(streams, Number.isNaN(height) ? Infinity : height);
  const videoBytes = video ? bytesOf(video, duration) : null;
  if (!video || videoBytes === null) return null;
  if (video.hasAudio) return videoBytes;
  const audio = bestAudio(streams, false);
  return videoBytes + ((audio && bytesOf(audio, duration)) ?? 0);
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
