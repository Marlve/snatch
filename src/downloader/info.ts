// One downloadable stream of a video, kept only for estimating file sizes.
export type Stream = {
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  vcodec: string;
  acodec: string;
  ext: string;
  // Size in bytes as the site reports it, when it does.
  size: number | null;
  // Average bitrate in kbit/s, used to estimate a size the site doesn't report.
  tbr: number | null;
};

// What the Options screen needs to know about a link, read from `yt-dlp --dump-json`.
export type VideoInfo = {
  title: string;
  uploader: string | null;
  // The site the video comes from, e.g. "youtube.com".
  site: string | null;
  // Length in seconds, when the site says.
  duration: number | null;
  // Address of the video's preview image, when the site gives one.
  thumbnail: string | null;
  // Distinct video heights, highest first.
  heights: number[];
  hasVideo: boolean;
  // True when the site serves a native m4a audio stream (no conversion needed).
  hasM4a: boolean;
  streams: Stream[];
};

type RawFormat = {
  ext?: string;
  vcodec?: string | null;
  acodec?: string | null;
  height?: number | null;
  video_ext?: string;
  filesize?: number | null;
  filesize_approx?: number | null;
  tbr?: number | null;
};

// Storyboard thumbnails and audio-only streams have vcodec "none", so they don't count as video.
const isVideo = (f: RawFormat) => f.vcodec !== "none" && f.video_ext !== "none";
const isNativeM4a = (f: RawFormat) => f.vcodec === "none" && f.acodec !== "none" && f.ext === "m4a";
const hasAudio = (f: RawFormat) => typeof f.acodec === "string" && f.acodec !== "none";

const toStream = (f: RawFormat): Stream => ({
  height: typeof f.height === "number" ? f.height : null,
  hasVideo: isVideo(f),
  hasAudio: hasAudio(f),
  vcodec: f.vcodec ?? "",
  acodec: f.acodec ?? "",
  ext: f.ext ?? "",
  size: f.filesize ?? f.filesize_approx ?? null,
  tbr: typeof f.tbr === "number" ? f.tbr : null,
});

export function parseInfo(json: string): VideoInfo | null {
  try {
    const raw = JSON.parse(json) as {
      title?: string;
      uploader?: string;
      channel?: string;
      webpage_url_domain?: string;
      extractor_key?: string;
      duration?: number;
      thumbnail?: string;
      formats?: RawFormat[];
    };
    const formats = raw.formats ?? [];
    const heights = new Set<number>();
    for (const f of formats) {
      if (isVideo(f) && typeof f.height === "number") heights.add(f.height);
    }
    return {
      title: raw.title ?? "video",
      uploader: raw.uploader ?? raw.channel ?? null,
      site: raw.webpage_url_domain ?? raw.extractor_key ?? null,
      duration: typeof raw.duration === "number" ? raw.duration : null,
      thumbnail: typeof raw.thumbnail === "string" && /^https?:\/\//.test(raw.thumbnail) ? raw.thumbnail : null,
      heights: [...heights].sort((a, b) => b - a),
      hasVideo: formats.some(isVideo),
      hasM4a: formats.some(isNativeM4a),
      streams: formats.map(toStream).filter((s) => s.hasVideo || s.hasAudio),
    };
  } catch {
    return null;
  }
}
