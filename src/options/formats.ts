import type { VideoInfo } from "../downloader/info.js";

export type Format = {
  id: "mp4" | "m4a";
  label: string;
  kind: "video" | "audio";
  // Shown in place of the quality choices, for formats that have none.
  qualityNote?: string;
};

// filename is the output name without its extension. folder is set by a preset; without one the file goes to Downloads.
export type Selection = { format: Format; quality: string | null; filename: string; folder?: string };

const MAX_QUALITIES = 6;

export const FORMATS: Format[] = [
  { id: "mp4", label: "MP4", kind: "video" },
  { id: "m4a", label: "M4A", kind: "audio", qualityNote: "Original audio, no conversion" },
];

// Only offer what this link can actually give.
export function availableFormats(info: VideoInfo): Format[] {
  return FORMATS.filter((f) => {
    if (f.id === "m4a") return info.hasM4a;
    if (f.kind === "video") return info.hasVideo;
    return true;
  });
}

// Audio formats have no quality choice. Video lists the real heights, best first.
export function qualitiesFor(format: Format, info: VideoInfo): string[] {
  if (format.kind === "audio") return [];
  if (info.heights.length === 0) return ["Best available"];
  return info.heights.slice(0, MAX_QUALITIES).map((h) => `${h}p`);
}
