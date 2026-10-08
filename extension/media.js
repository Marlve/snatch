// Decides whether a response is a media link worth offering. Shared by the background
// worker (as a module) and kept free of chrome.* so it can be run in Node.

const KINDS = [
  { label: "HLS", ext: /\.m3u8$/i, type: /mpegurl/i },
  { label: "DASH", ext: /\.mpd$/i, type: /dash\+xml/i },
  { label: "Video", ext: /\.(mp4|webm|mov|mkv|m4v)$/i, type: /^video\// },
  { label: "Audio", ext: /\.(mp3|m4a|flac|ogg|opus|wav)$/i, type: /^audio\// },
];

// Pieces of a stream, not something to download on their own.
const SEGMENT_EXT = /\.(ts|m4s|aac|vtt|srt)$/i;
const SEGMENT_TYPE = /^(video\/mp2t|video\/iso\.segment|audio\/aac)/i;

export function classify(url, contentType = "") {
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (SEGMENT_EXT.test(path) || SEGMENT_TYPE.test(type)) return null;
  const kind = KINDS.find((k) => k.ext.test(path) || (type && k.type.test(type)));
  return kind ? kind.label : null;
}
